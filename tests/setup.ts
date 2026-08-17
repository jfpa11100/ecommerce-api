import 'dotenv/config'
import { afterEach } from 'vitest'
import { vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
})