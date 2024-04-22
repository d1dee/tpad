import { readFile, utils } from "xlsx"
import { WeeklyAttendance } from "../index"
import {
    addWeeks,
    differenceInWeeks,
    isDate,
    isFriday,
    isFuture,
    isSameWeek,
    toDate,
} from "date-fns"
import { DEBUG } from "./constants"
import { string } from "yargs"
import { inspect } from "node:util"

const splitDates = (date: string) => {
    let d = date.split("/")
    return toDate(`${d[1].trim()}-${d[0].trim()}-${d[2].trim()}`)
}

const parseDateRanges = (dateString: string) => {
    let d = dateString?.split("-")
    if (d.length > 2) return new Error("Error: Invalid date range was supplied. Skipping... ")

    // Get start date and end date
    let [start, end] = [splitDates(d[0]), splitDates(d[1])]
    switch (true) {
        case !isDate(start) || !isDate(end):
            return new Error(
                `Error: Invalid date range was supplied, ${isDate(start) ? `${d[1]} is not a valid date` : `${d[0]} is not a valid date`}. Date should be in the format DD/MM/YYYY. Skipping... `,
            )
        case isFuture(start) || isFuture(end):
            return new Error(
                `Error: Invalid date range was supplied. ${isFuture(start) ? `start date (${d[0]})` : `end date (${d[1]})`} is in the future. Skipping... `,
            )
        case start > end:
            return new Error(
                `Error: Invalid date range was supplied. start date (${d[0]}) is more than end date ${d[1]}. Skipping... `,
            )
        case !isFriday(start) || !isFriday(end):
            return new Error(
                `Error: ${!isFriday(start) ? "Start " : "End "} date is not on a Friday. Skipping... `,
            )
        default:
            if (isSameWeek(start, end)) {
                console.error(
                    `Error: Invalid date supplied, start date (${start}) is in the same week as end date (${end})`,
                )
                return [start]
            }
            let numOfWeeks = differenceInWeeks(end, start),
                i = 0,
                observeDays = [],
                nextFriday = start
            while (numOfWeeks > i && end > nextFriday) {
                DEBUG && console.log(`Adding ${nextFriday} to days to observe.`)
                observeDays.push(nextFriday)
                nextFriday = addWeeks(nextFriday, 1)
                i++
            }
            return observeDays.length > 0
                ? observeDays
                : new Error("Error: Unexpected error while calculating weeks")
    }
}

const parseSpecificDates = (dateString: string) => {
    let dates = dateString?.split(",")
    let validDates = [] as Array<Date>
    for (const date of dates) {
        let d = splitDates(date)

        switch (true) {
            case !isDate(d):
                console.error(
                    new Error(
                        `Error: Invalid date ${date} was supplied. Date should  be in the format DD/MM/YYYY. Skipping...`,
                    ),
                )
                break
            case isFuture(date):
                console.error(
                    new Error(`Error: The provided date (${date}) is in the future. Skipping...`),
                )
                break
            case !isFriday(date):
                console.error(
                    new Error(
                        `Error: ${date} is not on a Friday. Weekly observations should only happen on Fridays. Skipping...`,
                    ),
                )
                break
            case validDates.every((date) => isSameWeek(date, d)):
                console.error(new Error(`Error: The Week with date ${d} was supplied. Skipping...`))
                break
            default:
                validDates.push(d)
        }
    }
    return validDates
}

const parseDates = (dateString: string) => {
    switch (true) {
        case dateString.includes("-"):
            DEBUG && console.log(`Parsing date ranges  ${dateString} to days to observe.`)
            return parseDateRanges(dateString)
        case dateString?.includes(","): {
            DEBUG && console.log(`Parsing specific dates  ${dateString} to days to observe.`)
            return parseSpecificDates(dateString)
        }
        default: {
            return new Error("Error: Invalid date format was supplied.")
        }
    }
}

export default (path: string) => {
    try {
        const workbook = readFile(path)

        if (workbook.SheetNames.length == 0) throw new Error(`No sheets found in ${path}`)
        else if (workbook.SheetNames.length > 1)
            throw new Error(`${path} has more than one sheet: ${workbook.SheetNames.join(", ")}`)

        let data = utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])

        if (data.length === 0) throw new Error("No data found in the excel file provided.")

        let errors = data.map((val: any, index) => {
            if (Array.isArray(val) || val === null)
                return {
                    error: `Object at index ${index} is of unsupported type.`,
                }

            let keys = Object.keys(val)
            if (
                ![
                    "code",
                    "name",
                    "term",
                    "lessonsTaught",
                    "lessonsRecovered",
                    "tobeTaught",
                    "dates",
                    "remarks",
                ].every((k) => keys.includes(k) && typeof val[k] !== "undefined")
            )
                return {
                    ...val,
                    Error: "One or more field are missing in the excel file provided.",
                }
        })

        if (errors.filter((v) => !!v).length > 0)
            throw new Error(
                `Errors were found while parsing the provided excel file: ${inspect(errors)}`,
            )

        let weeklyAttendances = data.map((val: any) =>
            !!val
                ? Object.fromEntries(
                      [
                          "code",
                          "name",
                          "term",
                          "lessonsTaught",
                          "lessonsRecovered",
                          "tobeTaught",
                          "dates",
                          "remarks",
                      ].map((k) => [
                          k,
                          typeof val[k] === "number" || typeof val[k] === "string"
                              ? String(val[k])
                              : undefined,
                      ]),
                  )
                : undefined,
        ) as Array<Partial<Omit<WeeklyAttendance, "dates">> & { dates: string }>

        // Parse dates here so that we can warn about errors early
        let error = []

        let res = [] as Array<WeeklyAttendance>

        for (const weeklyAttendance of weeklyAttendances) {
            console.log(
                `Parsing Dates for: ${[weeklyAttendance.name, weeklyAttendance.code].join(", ")}`,
            )
            let dateString = weeklyAttendance.dates

            let err = `Weekly attendance for ${weeklyAttendance.name ?? weeklyAttendance.code} has undefined or incorrect dates format. 
Date should be either:
    dd/mm/yyyy - dd/mm/yyyy for date ranges 
                or 
    dd/mm/yyyy, dd/mm/yyyy...(comma separated for specific dates)`

            if (!dateString) {
                console.log(err)
                continue
            }

            let dates = parseDates(dateString)

            if (dates instanceof Error) {
                console.error(dates.message)
                error.push(dates)
                continue
            }

            res.push({
                ...(weeklyAttendance as unknown as WeeklyAttendance),
                dates: dates,
            })
        }
        if (res.length > 0) return res

        throw new Error(
            `No valid entry was found. ${error.length} error(s) were encountered while parsing file. Failing..`,
        )
    } catch (err: any) {
        console.log(err.message)
        process.exit(1)
    }
}
