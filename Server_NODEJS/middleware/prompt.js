const checkPasswordPrompt = (req, res, next) => {
    // Check if user is authenticated and is a provider-based user without a password
    if (req.isAuthenticated() && req.user && req.user.provider !== 'local' && (!req.user.password || req.user.password.trim() === '')) {
        
        // Define paths that are always allowed
        const allowedPaths = [
            '/set-password',
            '/api/auth/set-initial-password',
            '/logout'
        ];

        // Also allow all static asset paths
        if (req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/img/')) {
            return next();
        }

        // Check if the current path is one of the allowed functional paths
        if (!allowedPaths.includes(req.path)) {
            // For any other path, redirect to the set-password page
            req.flash('error', 'To continue, you must set a password for your account.');
            return res.redirect('/set-password');
        }
    }
    
    next();
};

module.exports = { checkPasswordPrompt };
