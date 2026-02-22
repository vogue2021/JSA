// Authentication Validators
// 认证验证器

const Joi = require('joi');

// Login validation schema
const validateLogin = (data) => {
  const schema = Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': '请输入有效的邮箱地址',
        'any.required': '邮箱不能为空'
      }),
    password: Joi.string()
      .min(6)
      .required()
      .messages({
        'string.min': '密码至少6位',
        'any.required': '密码不能为空'
      })
  });

  return schema.validate(data);
};

// Registration validation schema
const validateRegister = (data) => {
  const schema = Joi.object({
    studentId: Joi.string()
      .pattern(/^\d{7}$/)
      .required()
      .messages({
        'string.pattern.base': '学号格式不正确',
        'any.required': '学号不能为空'
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': '请输入有效的邮箱地址',
        'any.required': '邮箱不能为空'
      }),
    password: Joi.string()
      .min(6)
      .required()
      .messages({
        'string.min': '密码至少6位',
        'any.required': '密码不能为空'
      }),
    confirmPassword: Joi.string()
      .valid(Joi.ref('password'))
      .required()
      .messages({
        'any.only': '两次密码输入不一致',
        'any.required': '请确认密码'
      }),
    name: Joi.string()
      .min(2)
      .max(50)
      .optional()
      .messages({
        'string.min': '姓名至少2个字符',
        'string.max': '姓名最多50个字符'
      })
  });

  return schema.validate(data);
};

// Teacher account creation validation
const validateCreateTeacher = (data) => {
  const schema = Joi.object({
    name: Joi.string()
      .min(2)
      .max(50)
      .required()
      .messages({
        'string.min': '姓名至少2个字符',
        'string.max': '姓名最多50个字符',
        'any.required': '姓名不能为空'
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': '请输入有效的邮箱地址',
        'any.required': '邮箱不能为空'
      }),
    password: Joi.string()
      .min(6)
      .required()
      .messages({
        'string.min': '密码至少6位',
        'any.required': '密码不能为空'
      })
  });

  return schema.validate(data);
};

// Student creation validation
const validateCreateStudent = (data) => {
  const schema = Joi.object({
    name: Joi.string()
      .min(2)
      .max(50)
      .required()
      .messages({
        'string.min': '姓名至少2个字符',
        'string.max': '姓名最多50个字符',
        'any.required': '姓名不能为空'
      }),
    email: Joi.string()
      .email()
      .optional()
      .messages({
        'string.email': '请输入有效的邮箱地址'
      }),
    teacherId: Joi.string()
      .required()
      .messages({
        'any.required': '必须分配老师'
      }),
    targetLevel: Joi.string()
      .valid('学部', '修士', '博士')
      .optional()
      .messages({
        'any.only': '申请层次必须是学部、修士或博士'
      })
  });

  return schema.validate(data);
};

module.exports = {
  validateLogin,
  validateRegister,
  validateCreateTeacher,
  validateCreateStudent
};