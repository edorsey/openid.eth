const asyncRoute = (route: any) => {
  return async (req: any, res: any, next: any) => {
    try {
      await route(req, res, next)
    } catch (err) {
      return next(err)
    }
  }
}

export default asyncRoute
