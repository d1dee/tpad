#!/usr/bin/env node
import "dotenv/config"
import yargs from "./src/yargs_cmd"
import excelToJson from "./src/excel"
import capture from "./src/cature"

export type WeeklyAttendance = {
    code: string
    name: string
    term: string
    lessonsTaught: string
    lessonsRecovered: string
    tobeTaught: string
    dates: Array<Date>
    remarks: string
}
export type LoginData = {
    hp: string
    idno: string
    password: string
    tscno: string
}
;(async () => {
    try {
        // Parse and validate given arguments
        let args = await yargs()

        // Parse excel file
        const weeklyAttendance = excelToJson(args.excel_file)
        let loginData = {
            hp: "",
            idno: args.id_number,
            password: args.password,
            tscno: args.tsc_number,
        }
        await capture(loginData, weeklyAttendance)
    } catch (err) {
        console.error(err)
    }
})()
