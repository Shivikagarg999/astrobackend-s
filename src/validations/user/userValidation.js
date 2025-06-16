const Joi = require('joi');

module.exports.registerForm = Joi.object({
    name: Joi.string().min(3).max(30).required().messages({
        'string.base': 'Name should be a string',
        'string.empty': 'Name cannot be empty',
        'any.required': 'Name is required'
    }),

    phone: Joi.string().min(3).max(30).required().messages({
        'string.base': 'phone should be a string',
        'string.empty': 'phone cannot be empty',
        'any.required': 'phone is required'
    }),

}).unknown(true);


module.exports.profileEditForm = Joi.object({
    name: Joi.string().min(3).max(30).required().messages({
        'string.base': 'Name should be a string',
        'string.empty': 'Name cannot be empty',
        'any.required': 'Name is required'
    }),


}).unknown(true);


