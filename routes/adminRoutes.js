const express = require("express");
const { addPackage, resetDatabase } = require("../controllers/adminController");

const router = express.Router();
router.post("/add-package", addPackage);
router.post("/reset-database", resetDatabase);

module.exports = router;
