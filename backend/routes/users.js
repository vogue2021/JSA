// Users Routes
// 用户路由

const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Get all users
router.get('/', async (req, res, next) => {
  try {
    const users = await db('users').select('*');
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
});

// Get single user
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await db('users').where('id', id).first();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
