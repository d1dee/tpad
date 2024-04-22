import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { accessSync, appendFileSync, readFileSync, writeFileSync } from "fs"
import * as constants from "node:constants"

export default async () => {
    try {
        // Check if we have env variables with all fields set
        const yargsInstance = yargs(hideBin(process.argv))
        yargsInstance
            .options({
                excel_file: {
                    demandOption: true,
                    default: process.env.PREVIOUS_FILE_CAPTURED,
                    describe: "Excel file path to parse weekly attendance data",
                    type: "string",
                },
                tsc_number: {
                    default: process.env?.TSC_NUMBER,
                    demandOption: true,
                    describe: "Deputy Principal's tsc number used to login to t-pad website",
                    type: "string",
                },
                id_number: {
                    default: process.env?.ID_NUMBER,
                    demandOption: true,
                    describe: "Deputy Principal's ID number used to login to t-pad website",
                    type: "string",
                },
                password: {
                    default: process.env?.PASSWORD,
                    demandOption: true,
                    describe: "Username used to login to t-pad website",
                    type: "string",
                },
            })
            .check((args) => {
                if (!args.tsc_number && !process.env?.TSC_NUMBER)
                    throw new Error("TSC number not supplied.")

                if (!args.id_number && !process.env?.ID_NUMBER)
                    throw new Error("Username not supplied.")

                if (!args.password && !process.env?.PASSWORD)
                    throw new Error("Password not supplied.")

                // Test if we can edit and access .env file
                try {
                    accessSync(".env", constants.F_OK)
                } catch (err: any) {
                    // Create .env file if it doesn't exist
                    if (err.code === "ENOENT") writeFileSync(".env", "")
                    else throw new Error(`Failed to add database location to .env: ${err.message}`)
                }

                const envString = readFileSync(".env", { encoding: "utf8" })
                let env = envString.split("\n")

                // Continue to add data to .env
                if (
                    args.tsc_number !== process.env.TSC_NUMBER ||
                    args.id_number !== process.env.ID_NUMBER
                ) {
                    let [tscIndex, passwordIndex, idIndex] = [
                        env.findIndex((v) => v.startsWith("TSC_NUMBER")),
                        env.findIndex((v) => v.startsWith("PASSWORD")),
                        env.findIndex((v) => v.startsWith("ID_NUMBER")),
                    ]

                    // If no tsc_number or password appendFile
                    if (tscIndex !== -1) env[tscIndex] = args.tsc_number
                    if (idIndex !== -1) env[idIndex] = args.id_number
                    if (passwordIndex !== -1) env[passwordIndex] = args.password

                    if (tscIndex === -1 && idIndex === -1 && passwordIndex === -1)
                        appendFileSync(
                            ".env",
                            `# T-pad tsc number, id number and password\nTSC_NUMBER=${args.tsc_number}\nID_NUMBER=${args.id_number}\nPASSWORD=${args.password}\n`,
                        )
                }

                if (args.excel_file !== process.env.PREVIOUS_FILE_CAPTURED) {
                    let previousFile = env.findIndex((v) => v.startsWith("PREVIOUS_FILE_CAPTURED"))

                    if (previousFile !== -1)
                        env[previousFile] = `PREVIOUS_FILE_CAPTURED="${args.excel_file}"\n`
                    else
                        appendFileSync(
                            ".env",
                            `# Previous files\nPREVIOUS_FILE_CAPTURED="${args.excel_file}"\n`,
                            {
                                encoding: "utf8",
                            },
                        )
                    try {
                        accessSync(args.excel_file)
                    } catch (err: any) {
                        if (err.code === "ENOENT") throw new Error("Excel file does not exist")
                        else throw err
                    }
                }

                if (env.join("\n") !== envString) writeFileSync(".env", env.join("\n"))

                return true
            })

        return yargsInstance.parse() as unknown as {
            excel_file: string
            tsc_number: string
            id_number: string
            password: string
        }
    } catch (error: any) {
        console.error(error)
        process.exit(1)
    }
}
