const { Device, Location, sequelize } = require('../database');

const getHomePage = (req, res) => {
    res.render('index', {
        currentPage: 'index',
        user: req.session.user
    });
};

module.exports = {
  getHomePage
}; 