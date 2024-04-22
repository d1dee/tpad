import { AxiosInstance } from "axios"
import qs from "qs"
import { awaits, exponentialBackoff } from "./utils"
import { WeeklyAttendance } from "../index"
import { formatISO } from "date-fns"

type Code = string
type Remarks = string
type Week = string
type TobeTaught = string
type LessonsTaught = string
type LessonsRecovered = string

// Loop for each teacher
export default async function observePerWeek(
    axios: AxiosInstance,
    teacherAttendance: WeeklyAttendance,
    ippd_code: string,
) {
    let capturedTeacher = { ...teacherAttendance, captured: [] } as WeeklyAttendance & {
        captured: Array<{ date: string; status: string }>
    }
    let failed: Array<Date> = [],
        dates = teacherAttendance.dates

    // Check if date is Friday if not skip
    const promises = dates.map((date) => {
        const data = qs.stringify({
            institution: ippd_code,
            lesson_attended: teacherAttendance.lessonsTaught,
            lesson_recovered: teacherAttendance.lessonsRecovered,
            summary: teacherAttendance.remarks,
            teacher: teacherAttendance.code,
            term: teacherAttendance.term,
            to_be_taught: teacherAttendance.tobeTaught,
            week_ending: date,
            year: new Date().getFullYear(),
        })
        const config = {
            method: "post",
            maxBodyLength: Infinity,
            url: "/teacher/save_attendance",
            data: data,
        }
        return new Promise(async (resolve) => {
            const [res, error] = await awaits(
                // Create a function that receives axios and config and returns an axios request promise.
                exponentialBackoff((axios, config) => axios(config), axios, config),
            )

            // If response.data returns 1, that week as already been capture, if 0 saved successfully
            if (error) failed.push(date)
            else
                capturedTeacher.captured.push({
                    date: formatISO(date, { representation: "date" }), // "2024-01-12",
                    status: res?.data == 0 || res?.data == 1 ? "Captured" : "Not captured",
                })
            resolve(true)
        })
    })

    await Promise.all(promises)

    failed.length > 0 &&
        console.warn(
            `Following dates failed to capture: ${failed.map((d) => formatISO(d, { representation: "date" })).join(", ")} retrying.`,
        )

    if (failed.length > 0) {
        // If a retry takes more than 5 minutes, reject
        const timeout_5m = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error("observePerWeek took too long to execute"))
            }, 300000) // 5 minutes
        })

        let retryResults = (await Promise.race([
            observePerWeek(axios, teacherAttendance, ippd_code),
            timeout_5m,
        ])) as typeof capturedTeacher
        capturedTeacher.captured = capturedTeacher.captured.concat(retryResults.captured)
    }

    return capturedTeacher
}
