import { AxiosError, AxiosResponse } from "axios"
import { inspect } from "node:util"

const awaits = async (
    promise: Promise<AxiosResponse>,
): Promise<[Awaited<AxiosResponse>, null] | [null, any]> => {
    try {
        let response = await promise
        if (!response?.data)
            throw new Error(
                inspect({
                    status: false,
                    code: 401,
                    message: "Login page did not respond to login",
                    headers: response?.headers,
                }),
            )

        return [response, null]
    } catch (error) {
        if (error instanceof AxiosError) {
            return [
                null,
                new Error(
                    inspect({
                        status: false,
                        code: error.code,
                        message: error.message,
                    }),
                ),
            ]
        }
        return [null, error]
    }
}

const exponentialBackoff = async <T, P extends any[]>(
    promiseFactory: (...args: P) => Promise<T>,
    ...args: P
): Promise<T> => {
    let retries = 0,
        maxRetries = 15,
        delay = 1000

    async function attempt(): Promise<T> {
        try {
            return await promiseFactory(...args) // Pass arguments to promiseFactory
        } catch (err: any) {
            if (retries === maxRetries) {
                console.error("Maximum number of retries reached.")
                throw err
            } else {
                delay *= 1.5
                retries++
                console.error(`Error: ${err.code}. Retrying, Attempt number: ${retries}.`)
                await new Promise((resolve) => setTimeout(resolve, delay))
                return attempt()
            }
        }
    }

    // initial call
    return attempt()
}
export { awaits, exponentialBackoff }
