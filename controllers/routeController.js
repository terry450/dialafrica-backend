const { getAllRoutes } = require("../config/rates");

/*
  Public: Get all supported routes
*/

exports.getRoutes = async (req, res) => {
  try {
    const routes = getAllRoutes();

    res.json({
      totalRoutes: routes.length,
      routes
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
};

/*
  Admin: Get only active routes
*/

exports.getActiveRoutes = async (req, res) => {
  try {
    const routes = getAllRoutes();

    const activeRoutes = routes.filter(
      (route) => route.active === true
    );

    res.json({
      totalActiveRoutes: activeRoutes.length,
      routes: activeRoutes
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
};

/*
  Admin: Get only inactive routes
*/

exports.getInactiveRoutes = async (req, res) => {
  try {
    const routes = getAllRoutes();

    const inactiveRoutes = routes.filter(
      (route) => route.active === false
    );

    res.json({
      totalInactiveRoutes: inactiveRoutes.length,
      routes: inactiveRoutes
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
};