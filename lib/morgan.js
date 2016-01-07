(function () {
    'use strict';
    var morganTokens = require('./morgan-tokens')



    exports.addLogger = function (tokens, immediate) {
        if (!this.morgan) {
            this.morgan = require('morgan');
            morganTokens.addTokens(this.morgan);
        }

        function skipFn(req) {
            if (req.noLog || (req.query && req.query.noLog)) {
                return true;
            }
        }

        if (!tokens) {
            tokens =
                ':time :customMethod :customStatus :urlWithUser :responseTime :params :customUa'
        }

        var morganFn = this.morgan(tokens, {
            immediate: immediate,
            skip: skipFn
        });

        this.app.use(morganFn);

        var manualLogger = this.morgan(tokens, {
            immediate: true
        });

        this.log = function (req, res) {

            if (typeof req === 'string') {
                req = {
                    url: req,
                    method: 'LOG'
                }
            }

            if (skipFn(req)) {
                return this;
            }

            manualLogger(req, res || {}, function () {})
            return this;
        }
        this.app.log = this.log.bind(this);

        return this;
    }

})()
