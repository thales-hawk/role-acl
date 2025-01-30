// Replace the static require with dynamic import
module.exports = async function () {
  const { AccessControl } = await import("./lib/src");
  // Assign the AccessControl to module.exports
  module.exports = AccessControl;
  module.exports.AccessControl = AccessControl;
};
