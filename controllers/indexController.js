const getIndexPage = (req, res) => {
  res.render('index', { currentPage: 'index' }); 
};

const getDevicePage = (req, res) => {
  res.render('device', { currentPage: 'device' });
};

module.exports = {
  getIndexPage,
  getDevicePage,
}; 