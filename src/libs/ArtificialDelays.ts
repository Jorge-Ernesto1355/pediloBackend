import { Request, Response, NextFunction } from 'express'

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

export const artificialDelay = async (
  _req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (process.env.ARTIFICIAL_DELAY !== 'true') {
    next()
    return
  }

  const min = Number(process.env.ARTIFICIAL_DELAY_MIN ?? 800)
  const max = Number(process.env.ARTIFICIAL_DELAY_MAX ?? 1500)

  const delay = Math.floor(
    Math.random() * (max - min + 1) + min
  )

  await sleep(delay)

  next()
}