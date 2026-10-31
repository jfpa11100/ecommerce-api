import type { Request, Response, NextFunction } from 'express'
import os from 'node:os'

//   APP_VERSION -> version exacta de la release
//   TRACK       -> stable | canary
export const APP_VERSION = process.env.APP_VERSION ?? 'dev'
export const APP_TRACK = process.env.TRACK ?? 'unknown'
export const INSTANCE_ID = process.env.HOSTNAME ?? os.hostname()

export function versionHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-App-Version', APP_VERSION)
  res.setHeader('X-App-Track', APP_TRACK)
  res.setHeader('X-App-Instance', INSTANCE_ID)
  next()
}
