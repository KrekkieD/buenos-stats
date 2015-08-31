'use strict';

var $q = require('q');
var $cheerio = require('cheerio');
var $table = require('cli-table');
var $yargs = require('yargs');

var $https = require('https');
var $fs = require('fs');

// only support cli for now
cli();

function cli () {

    // extract cli params
    var args = $yargs.argv;

    if (args['?']) {
        showManual();
    }

    // remove current config?
    if (args.unstore) {
        try {
            $fs.unlinkSync(__dirname + '/stored-query.json');
            console.log('Removed stored config.');
            process.exit();
        } catch (e) {}
    }


    var config = {
        users: [],
        packages: []
    };

    if (!args.user && args._.length === 0) {

        try {
            var storedConfig = $fs.readFileSync(__dirname + '/stored-query.json');
            storedConfig = JSON.parse(storedConfig);
            config.users = storedConfig.users || config.users;
            config.packages = storedConfig.packages || config.packages;
            console.log('Loaded stored config');
        } catch (e) {
            showManual();
        }

    }
    else {

        if (args.user) {
            config.users = Array.isArray(args.user) ? args.user : args.user.split(',');
        }

        // packages
        if (args._.length) {
            config.packages = args._;
        }

        // confirm command makes sense
        if (config.packages.length === 0 && config.users.length === 0) {
            showManual();
        }

        // store config?
        if (args.store) {

            $fs.writeFile(__dirname + '/stored-query.json', JSON.stringify(config, null, 4), function (err) {
                if (err) { throw err }
                else {
                    console.log('Stored query.');
                }
            });

        }

    }

    buenosStats(config);

}

function showManual () {
    console.log($fs.readFileSync(__dirname + '/help.txt').toString());
    console.log();

    try {
        var storedConfig = $fs.readFileSync(__dirname + '/stored-query.json');
        console.log('Stored config:');
        console.log(storedConfig.toString());
    } catch (e) {
        console.log('No stored config found.');
    }


    process.exit();
}

function buenosStats (config) {

    if (config.users) {

        // get packages for each defined user
        getUserPackages(config.users)
            .then(function (packages) {

                // merge with predefined packages
                Array.prototype.push.apply(config.packages, packages);

                // filter doubles, if any
                config.packages = config.packages.filter(_arrayUniqueFilter);

            })
            .then(function () {
                delete config.users;
                return buenosStats(config);
            });

    }
    else {

        scrapePackages(config.packages)
            .then(function (stats) {

                // parse stats to array of arrays
                var statsArray = [
                    ['Package name', 'daily', 'weekly', 'monthly']
                ];
                Object.keys(stats).forEach(function (packageName) {

                    var pkg = stats[packageName];
                    statsArray.push([packageName, pkg.dailyDownloads, pkg.weeklyDownloads, pkg.monthlyDownloads]);

                });

                // extract required column lengths
                var colWidths = [0, 0, 0, 0];
                statsArray.forEach(function (result) {

                    var i = 0;
                    result.forEach(function (colValue) {

                        colWidths[i] = Math.max(colWidths[i], colValue.toString().length + 5);
                        i++;

                    });

                });


                var table = new $table({
                    head: statsArray.shift(),
                    colAligns: ['left', 'right', 'right', 'right'],
                    colWidths: colWidths
                });

                Array.prototype.push.apply(table, statsArray);



                console.log(table.toString());

            })
            .catch(function (err) {
                throw err;
            });

    }
}

function getUserPackages (users) {

    var deferred = $q.defer();

    var packages = [];

    var deferreds = [];
    users.forEach(function (user) {

        deferreds.push(getPage('/~' + user)
            .then(scrapeUserPage)
            .then(function (userPackages) {

                Array.prototype.push.apply(packages, userPackages);

            }));

    });

    $q.allSettled(deferreds)
        .then(function () {
            deferred.resolve(packages);
        });

    return deferred.promise;

}

function scrapePackages (packages) {

    var deferred = $q.defer();

    var results = {};

    var deferreds = [];
    packages.forEach(function (packageName) {

        results[packageName] = {};

        deferreds.push(getPage('/package/' + packageName)
            .then(scrapePackagePage)
            .then(function (stats) {

                results[packageName] = stats;

            }));

    });

    $q.allSettled(deferreds)
        .then(function () {

            deferred.resolve(results);

        });

    return deferred.promise;

}

function getPage (path) {

    var deferred = $q.defer();

    var req = $https.request({
        hostname: 'www.npmjs.com',
        path: path,
        method: 'GET'
    }, function (res) {

        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });

        res.on('error', function (err) {
            deferred.reject(err);
        });

        res.on('end', function () {
            deferred.resolve(Buffer.concat(chunks).toString());
        });

    });

    // send
    req.end();

    return deferred.promise;

}

function scrapePackagePage (html) {

    var stats = {
        dailyDownloads: 'unknown',
        weeklyDownloads: 'unknown',
        monthlyDownloads: 'unknown'
    };

    // cheerio work here
    var $ = $cheerio.load(html);

    stats.dailyDownloads = $('.daily-downloads').text() || stats.dailyDownloads;
    stats.weeklyDownloads = $('.weekly-downloads').text() || stats.weeklyDownloads;
    stats.monthlyDownloads = $('.monthly-downloads').text() || stats.monthlyDownloads;

    return stats;

}


function scrapeUserPage (html) {

    var packages = [];

    // cheerio work here
    var $ = $cheerio.load(html);

    $('.collaborated-packages a').each(function (el) {
        packages.push($(this).text());
    });

    return packages;

}

function _arrayUniqueFilter (value, index, self) {
    return self.indexOf(value) === index;
}
