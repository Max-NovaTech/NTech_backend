// Dummy authentication middleware for testing
module.exports = (req, res, next) => {
  // Simulate a logged-in admin user
  req.user = { id: "1", role: 'admin' };
  next();
}
