const Joi = require('joi');

/** Wraps a Joi schema into an Express middleware that validates req.body */
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return res.status(422).json({
        code: 'Validation.Failed',
        description: error.details.map(d => d.message).join('; '),
      });
    }
    req.body = value;
    next();
  };
}

module.exports = { validate, Joi };
