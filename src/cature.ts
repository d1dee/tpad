import axios, { AxiosError, AxiosInstance } from "axios"
import qs from "qs"
import { writeFileSync } from "fs"
import observePerWeek from "./observe"
import { parse } from "node-html-parser"
import { DEBUG } from "./constants"
import { LoginData, WeeklyAttendance } from "../index"
import { exponentialBackoff } from "./utils"
import { inspect } from "node:util"
import { existsSync, mkdirSync } from "node:fs"

const HEADERS = {
    "sec-ch-ua": '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    DNT: "1",
    "Upgrade-Insecure-Requests": "1",
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-User": "?1",
    "Sec-Fetch-Dest": "document",
    host: "tpad2.tsc.go.ke",
}

// Login and return institutions ippd_code
const login = async (loginData: LoginData, axiosInstance: AxiosInstance) => {
    try {
        let homepageRes = await axiosInstance.get("/")

        const cookies = homepageRes?.headers["set-cookie"]

        if (!cookies || !Array.isArray(cookies)) {
            console.error(new Error("Session cookie was not set. Rerun script to resubmit."))
            process.exit(1)
        }

        Object.assign(HEADERS, { cookie: cookies.join("; ") })

        const loginConfig = {
            method: "post",
            maxBodyLength: Infinity,
            url: "/auth/login_user",
            headers: HEADERS,
            data: qs.stringify(loginData),
        }
        let loginRes = await axiosInstance.request(loginConfig)

        let table = parse(loginRes.data).querySelector(
            "#main-wrapper > div > div > div.row.page-titles > div > div:nth-child(2) > div > div > div",
        )

        console.log(
            [
                "Logged in user's details:",
                table?.querySelector("tr:nth-child(1) > td:nth-child(1)")?.structuredText?.trim(),
                table?.querySelector("tr:nth-child(1) > td:nth-child(2)")?.structuredText?.trim(),
                table?.querySelector("tr:nth-child(2) > td:nth-child(2)")?.structuredText?.trim(),
                table?.querySelector("tr:nth-child(2) > td:nth-child(1)")?.structuredText?.trim(),
            ].join("\n\t"),
        )

        DEBUG &&
            (() => {
                if (!existsSync("./debug")) mkdirSync("./debug")
                writeFileSync("./debug/index.html", loginRes?.data)
            })()

        return table
            ?.querySelector("tr:nth-child(1) > td:nth-child(2)")
            ?.structuredText?.split(":")
            ?.pop()
            ?.trim()
    } catch (err: any) {
        if (err instanceof AxiosError) {
            throw err
        } else {
            console.error("Unhandled Error was encountered... Exiting....")
            console.error(err)
            process.exit(1)
        }
    }
}

export default async (loginData: LoginData, weeklyAttendance: Array<WeeklyAttendance>) => {
    try {
        const axiosInstance = axios.create({ baseURL: "https://tpad2.tsc.go.ke", timeout: 30000 })

        DEBUG && console.debug(`Login in with the provided details: ${inspect(loginData)} `)

        let ippd_code = await exponentialBackoff(login, loginData, axiosInstance)

        // Fail no ipd_code since we can not continue without it
        if (!ippd_code) throw new Error("Failed to get ippd_code from the home page.")

        // Loop through each teacher observing
        for await (const teachersAttendance of weeklyAttendance) {
            console.log(
                `Capturing weekly attendance for : ${[teachersAttendance.name, teachersAttendance.code].join(", ")}`,
            )
            let k = (await observePerWeek(axiosInstance, teachersAttendance, ippd_code)) as Omit<
                WeeklyAttendance,
                "dates"
            > & { dates?: Array<Date> }
            delete k.dates
            console.log(`Teacher has been captured: ${inspect(k)}`)
        }
    } catch (err) {
        console.error(err)
        process.exit(1)
    }
}
