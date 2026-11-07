/**
 * HTML forms send empty strings for untouched optional fields ("", not
 * undefined). Those would fail `.optional()` schemas (email, dates, numbers),
 * so they are normalised away before validation.
 */
function stripEmptyStrings(value) {
  if (Array.isArray(value)) return value.map(stripEmptyStrings);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, nested]) => [key, stripEmptyStrings(nested)])
        .filter(([, nested]) => nested !== undefined && nested !== null)
    );
  }
  if (value === "") return undefined;
  return value;
}

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(stripEmptyStrings(req.body));
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.flatten(),
      });
    }
    req.body = result.data;
    next();
  };
}
