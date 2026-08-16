export class NotFoundError extends Error {
  constructor(message = 'Item not found') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends Error {
  constructor(message = 'Conflict occurred with the request') {
    super(message)
    this.name = 'ConflictError'
  }
}

export class BadRequestError extends Error {
  constructor(message = 'Bad request') {
    super(message)
    this.name = 'BadRequestError'
  }
}