'use strict';

var es = require('event-stream');
var gutil = require('gulp-util');
var mime = require('mime');
var ALY = require('aliyun-sdk');
mime.default_type = 'text/plain';

module.exports = function(aws, options) {
    options = options || {};
    var maxTries = options.maxRetry || 3;

    if (!options.delay) {
        options.delay = 0;
    }

    ALY.config.update({
        accessKeyId: aws.key,
        secretAccessKey: aws.secret
    });

    var oss = new ALY.OSS({
        endpoint: aws.endpoint,
        apiVersion: '2013-10-15'
    });

    var regexGeneral = /\.([a-z]{2,})$/i;

    return es.mapSync(function(file) {

        // Verify this is a file
        if (!file.isBuffer()) {
            return file;
        }

        var uploadPath = file.path.replace(file.base, options.uploadPath || '');
        uploadPath = uploadPath.replace(new RegExp('\\\\', 'g'), '/');

        var headers = {};
        if (options.headers) {
            for (var key in options.headers) {
                headers[key] = options.headers[key];
            }
        }

        // Set content type based of file extension
        if (!headers['ContentType'] && regexGeneral.test(uploadPath)) {
            headers['ContentType'] = mime.lookup(uploadPath);
        }

        //headers['Content-Length'] = file.stat.size;

        headers['Body'] = file.contents;

        headers['Key'] = uploadPath;

        var tryNum = 1;
        var upload = function() {
            oss.putObject(headers,
                function(err, data) {

                    if (err) {
                        if (tryNum > maxTries) {
                            gutil.log(gutil.colors.red('[FAILED]', file.path + " -> " + uploadPath));
                            gutil.log(err);
                        } else {
                            gutil.log(gutil.colors.red('[FAILED RETRY]', file.path + " -> " + uploadPath));
                            tryNum++;
                            upload();
                        }
                        return;
                    }

                    gutil.log(gutil.colors.green('[SUCCESS]', file.path + " -> " + uploadPath));

                });
        };
        upload();

        return file;
    });
};
