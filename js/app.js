/*
 kanton-bern-finanzen https://github.com/KeeTraxx/kanton-bern-finanzen
 Copyright (C) 2014  Khôi Tran

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
angular.module('ktbe', [
    'ngRoute',
    'ngSanitize',
    'ktbe.controllers',
    'ktbe.directives',
    'ktbe.filters',
    'ktbe.services'
])
    .config(['$routeProvider', function ($routeProvider) {
        $routeProvider.when('/:year/:code?', {templateUrl: 'index', controller: 'VisualizationController'});
        $routeProvider.otherwise({redirectTo: '/2013'});
    }])
    .run(['$route', '$rootScope', '$location', function ($route, $rootScope, $location) {
        var original = $location.path;
        $location.path = function (path, reload) {
            if (reload === false) {
                var lastRoute = $route.current;
                var un = $rootScope.$on('$locationChangeSuccess', function () {
                    $route.current = lastRoute;
                    un();
                });
            }

            return original.apply($location, [path]);
        };
    }]);

angular.module('ktbe.controllers', [])
    .controller('VisualizationController', ['$scope', '$http', '$location', '$routeParams', '$timeout', 'FinanceService', 'DescriptionService', '$q', function ($scope, $http, $location, $routeParams, $timeout, FinanceService, DescriptionService, $q) {
        $scope.color = function (input) {
            var c = d3.scale.category10().domain(d3.range(0, 10));
            var base = d3.hsl(c(input[0]));
            base.h += +( input[1] || 0 ) * 5;
            base.s += +( input[1] || 0 ) / 20;
            base.l += +( input[1] || 0 ) / 30;
            return base;
        };

        $q.all([FinanceService, DescriptionService]).then(function (results) {
            $scope.data = results[0];
            $scope.descriptions = d3.map(results[1], function (d) {
                return d.code
            });
            $scope.$watchCollection('filter', updateUrl);
            //$scope.$watch('selectedCode', updateUrl);

            function updateUrl(filter) {
                $location.path(filter.year + '/' + (filter.code || ''), false);
            }
        });
    }]);

angular.module('ktbe.directives', ['ui.bootstrap'])
    .directive('slider', ['$routeParams', 'FinanceService', function ($routeParams, FinanceService) {
        return {
            restrict: 'A',
            link: function (scope, el) {
                scope.filter = {
                    year: $routeParams.year || '2013',
                    code: $routeParams.code || ''
                };
                FinanceService.then(function (financeData) {
                    var extent = d3.extent(financeData, function (d) {
                        return d.year;
                    });
                    var sliderConf = d3.slider()
                        .min(extent[0])
                        .max(extent[1])
                        .axis(true)
                        .step(1)
                        .value($routeParams.year || extent[1])
                        .on('slide', function (e, value) {
                            scope.filter.year = value;
                            scope.$apply();
                        });
                    /*scope.filter = scope.filter || {
                     year: $routeParams.year != 'undefined' ? $routeParams.year : extent[1],
                     code: ''
                     };*/
                    d3.select(el[0]).call(sliderConf);
                });
            }
        }
    }])
    .directive('visualization', ['$window', '$filter', 'FinanceService', function ($window, $filter, FinanceService) {
        return {
            restrict: 'A',
            link: function (scope, el) {
                var svg = d3.select(el[0]);
                var force = d3.layout.force()
                    .gravity(0.05)
                    .on('tick', tick);

                var nodes = [];
                var clusters = {
                    revenue: {
                        x: 100,
                        y: 200,
                        radius: 0
                    },
                    expense: {
                        x: 300,
                        y: 200,
                        radius: 0
                    }
                };

                scope.$watchCollection('filter', function (filter) {
                    FinanceService.then(function (data) {

                        function hasChildren(node) {
                            if (node.code == '') return true;
                            var regexp = new RegExp('^' + node.code + '[0-9]+$');
                            return data.some(function (d) {
                                return d.code.match(regexp);
                            });
                        }

                        scope.filteredData = data.filter(function (d) {
                            return d.year == filter.year && d.code.match(new RegExp('^' + filter.code + '[0-9]$'));
                        });

                        scope.filteredData.forEach(function (d) {
                            d.hasChildren = hasChildren(d);
                        });

                        scope.parent = {
                            revenue: _.find(data, function (d) {
                                return d.code == filter.code && d.year == filter.year && d.type == 'revenue';
                            }),
                            expense: _.find(data, function (d) {
                                return d.code == filter.code && d.year == filter.year && d.type == 'expense';
                            })
                        };

                        update();
                    });
                });
                //scope.$watch('selectedNode', update);

                scope.$watch('hover', function (node) {

                    svg.selectAll('circle.border')
                        .transition()
                        .style('stroke-width', 2);

                    if (!node) return;

                    var g = svg.selectAll('g.node')
                        .filter(function (d) {
                            return d.code == node.code;
                        });

                    g.select('circle.border')
                        .transition()
                        .style('stroke-width', 7);

                    g.select('g.bear')
                        .transition()
                        .attr('transform', 'rotate(30)')
                        .transition()
                        .duration(2000)
                        .ease('elastic-in')
                        .attr('transform', 'rotate(0)');
                });

                $($window).on('resize', update);
                var tip = d3.tip().attr('class', 'd3-tip').html(function (d) {
                    var parent = scope.parent[d.type];

                    var percentage =  (d.value / parent.value * 100).toFixed(2);

                    return '<h4 style="text-align: center">' + d.name + '</h4>' +
                            '<p style="text-align: center">' + $filter('swissFormat')(d.value) + ' Fr. ('+percentage+'%)</p>';
                });
                svg.call(tip);
                svg.on('click', function () {
                    if (scope.filter.code.length > 0 && d3.event.target == this) {
                        scope.filter.code = scope.filter.code.substr(0, scope.filter.code.length - 2);
                        scope.$apply();
                        ga('send', 'event', 'parent', scope.filter.code || 'root');
                    }
                });
                function tick(e) {
                    d3.selectAll('g.node')
                        .each(cluster(10 * e.alpha * e.alpha))
                        .each(collide(0.3))
                        .attr("transform", function (d) {
                            return 'translate(' + d.x + ',' + d.y + ')';
                        });
                }

                var padding = 6; // separation between same-color nodes
                var clusterPadding = 18; // separation between different-color nodes
                var maxRadius = 100;

                function collide(alpha) {
                    var quadtree = d3.geom.quadtree(scope.filteredData);
                    return function (d) {
                        var r = d.radius + Math.max(padding, clusterPadding),
                            nx1 = d.x - r,
                            nx2 = d.x + r,
                            ny1 = d.y - r,
                            ny2 = d.y + r;
                        quadtree.visit(function (quad, x1, y1, x2, y2) {
                            if (quad.point && (quad.point !== d)) {
                                var x = d.x - quad.point.x,
                                    y = d.y - quad.point.y,
                                    l = Math.sqrt(x * x + y * y),
                                    r = d.radius + quad.point.radius + (d.cluster === quad.point.cluster ? padding : clusterPadding);
                                if (l < r) {
                                    l = (l - r) / l * alpha;
                                    d.x -= x *= l;
                                    d.y -= y *= l;
                                    quad.point.x += x;
                                    quad.point.y += y;
                                }
                            }
                            return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
                        });
                    };
                }

                // Move d to be adjacent to the cluster node.
                function cluster(alpha) {
                    return function (d) {
                        var cluster = clusters[d.type];
                        if (cluster === d) return;
                        var x = d.x - cluster.x,
                            y = d.y - cluster.y,
                            l = Math.sqrt(x * x + y * y),
                            r = 0;
                        //r = d.radius + cluster.radius;
                        if (l != r) {
                            l = (l - r) / l * alpha;
                            d.x -= x *= 0.01;
                            d.y -= y *= 0.01;
                            /*cluster.x += x;
                             cluster.y += y;*/
                        }
                    };
                }

                // Reference circles
                svg.append('g').attr('class', 'reference');

                // Nodes
                var nodesG = svg.append('g')
                    .attr('class', 'nodes');

                function update() {
                    // do nothing if there is no year and node

                    var height = parseInt(svg.style('height'));
                    var width = parseInt(svg.style('width'));

                    d3.select('#year')
                        .attr('transform', function () {
                            var bb = this.getBBox();
                            var widthTransform = width / bb.width / 2.6;
                            return 'scale(' + widthTransform + ')';
                        });

                    maxRadius = height / 6;


                    clusters.revenue.x = width / 4;
                    clusters.revenue.y = height / 2;

                    clusters.expense.x = width / 4 * 3;
                    clusters.expense.y = height / 2;

                    var clusterText = svg.select('#labels').selectAll('g.cluster')
                        .data([clusters.revenue, clusters.expense]);

                    svg.selectAll('g.cluster').attr({
                        transform: function (d) {
                            return 'translate(' + d.x + ', ' + d.y + ')';
                        }
                    }).selectAll('text').attr({
                        transform: function () {
                            var bb = this.getBBox();
                            var widthTransform = width / bb.width / 3;
                            return 'scale(' + widthTransform + ')';
                        }
                    });

                    scope.filteredData.forEach(function (d) {
                        d.x = clusters[d.type].x;
                        d.y = clusters[d.type].y;
                    });


                    var data = scope.filteredData;

                    var max = d3.max(data, function (d) {
                        return d.value;
                    });

                    var scale = d3.scale.sqrt()
                        .domain([0, max])
                        .range([1, height / 8]);

                    data.forEach(function (d) {
                        d.radius = scale(d.value);
                    });


                    var maxLog = ~~(Math.log(max) * Math.LOG10E);
                    var maxRefCircle = Math.pow(10, maxLog);
                    var refCircleData = [maxRefCircle, maxRefCircle / 2, maxRefCircle / 10];
                    svg.select('g.reference').attr({
                        transform: function (d) {
                            return 'translate(120,' + (height - 90) + ')'
                        }
                    });

                    var refCircles = svg.select('.reference').selectAll('g').data(refCircleData);
                    var refEnter = refCircles.enter().append('g');
                    refEnter.append('circle');
                    refEnter.append('text');
                    refCircles.exit().remove();

                    refCircles.select('circle')
                        .transition()
                        .attr({
                            r: function (d) {
                                return scale(d);
                            },
                            cy: function (d) {
                                return -scale(d);
                            }
                        });

                    refCircles.select('text').text(function (d) {
                        return $filter('humanReadable')(d * 1000);
                    }).attr({
                        y: function (d) {
                            return -scale(d) * 2 - 5;
                        }
                    });


                    force
                        .nodes(data)
                        .size([width, height])
                        .start();

                    var nodeG = nodesG
                        .selectAll('g.node')
                        .data(data, function (d) {
                            return d.year + d.code + d.type;
                        });

                    nodeG.exit()
                        //.transition()
                        //.attr('transform', 'scale(0)')
                        .remove();

                    var g = nodeG.enter()
                        .append('g')
                        .attr('class', 'node')
                        .classed('hasChildren', function (d) {
                            return d.hasChildren;
                        })
                        .on('click', function (d) {
                            if (d3.event.defaultPrevented) return;
                            if (d.hasChildren) {
                                scope.filter.code = d.code;
                                scope.$apply();
                            }
                            ga('send', 'event', 'bubbleClick', d.name || 'root');

                        });


                    g.append('g')
                        .attr('class', 'bear').append('use')
                        .attr('xlink:href', '#bear')
                        .attr('opacity', 0.2);

                    g.append('circle')
                        .attr('class', 'backdrop')
                        .attr('fill', function (d) {
                            var code;

                            if (d.code === '') {
                                code = d.type == 'revenue' ? '0' : '3';
                            } else {
                                code = d.code;
                            }

                            return scope.color(code);
                        })
                        .style('opacity', 0.6)
                        .on('mouseover', function (d) {
                            tip.show(d);
                            scope.hover = d;
                            scope.$apply();
                        })
                        .on('mouseout', function (d) {
                            tip.hide(d);
                            scope.hover = null;
                            scope.$apply();
                        });

                    g.on('mousedown', tip.hide);


                    g.append('circle')
                        .attr('fill', 'none')
                        .attr('class', 'border')
                        .style('stroke', function (d) {
                            var code;

                            if (d.code === '') {
                                code = d.type == 'revenue' ? '0' : '3';
                            } else {
                                code = d.code;
                            }

                            return scope.color(code);
                            //return d.type == 'revenue' ? '#3f3' : '#f33';
                        })
                        .style('stroke-width', 2)
                        .style('opacity', 0.6);

                    g.append('text');

                    nodeG.select('text')
                        .attr('transform', function (d) {
                            return 'scale(' + d.radius / 50 + ')';
                        }).text(function (d) {
                            return $filter('humanReadable')(d.value * 1000, maxLog);
                        });

                    nodeG.selectAll('circle')
                        .attr('r', function (d) {
                            return d.radius;
                        });

                    nodeG.call(force.drag);

                    nodeG.select('use')
                        .attr('transform', function (d) {
                            return 'rotate(-45),scale(' + d.radius / 80 + ')'
                        })
                        .transition()
                        .duration(750)
                        .delay(function (d, i) {
                            return i * 50
                        })
                        .ease('back-out')
                        .attr('transform', function (d) {
                            return 'rotate(0),scale(' + d.radius / 60 + ')'
                        });

                }
            }
        }
    }
    ])
    .directive('financeTable', ['$filter', '$modal', function ($filter, $modal) {
        return {
            restrict: 'A',
            link: function (scope, el) {
                scope.$watchCollection('filteredData', update);
                //scope.$watch('selectedYear', update);

                var table = d3.select(el[0]);

                scope.$watch('hover', function (node) {
                    table.selectAll('tbody tr').classed('info', false);
                    if (!node) return;
                    var tr = table.selectAll('tbody tr').filter(function (d) {
                        return node.code == d.code || node.code == d.key;
                    }).classed('info', true);
                });

                function update() {
                    if (!scope.filteredData) return;

                    var descriptions = {};
                    scope.data.forEach(function (d) {
                        if (d.code && d.description && !descriptions[d.code]) {
                            descriptions[d.code] = d.description;
                        }
                    });

                    scope.breadcrumbs = [];

                    for (var i = 1; i <= scope.filter.code.length; i++) {
                        var search = scope.filter.code.substr(0, i);
                        scope.breadcrumbs.push(_.find(scope.data, function (d) {
                            return d.code == search;
                        }));
                    }

                    var data = d3.nest()
                        .key(function (d) {
                            return d.code
                        })
                        .key(function (d) {
                            return d.type
                        }).sortKeys()
                        .entries(scope.filteredData);

                    scope.foundDescriptions = scope.filteredData.some(function (d) {
                        return d.description != undefined;
                    });

                    var tr = table.select('tbody').selectAll('tr').data(data, function (d) {
                        return d.key;
                    });

                    tr.exit()
                        .remove();

                    var newTr = tr.enter()
                        .append('tr')
                        .on('mouseover', function (d) {
                            scope.hover = {code: d.key};
                            scope.$apply();
                        })
                        .on('mouseout', function (d) {
                            scope.hover = null;
                            scope.$apply();
                        });

                    var td = newTr.append('td')
                        .attr('class', 'infocol')
                        .html(function (d) {
                            return descriptions[d.key] ? '<i class="fa fa-info-circle"></i>' : '<i class="fa fa-circle"></i>';
                        })
                        .style('color', function (d) {
                            return scope.color(d.key);
                        })
                        .on('click', function (d) {
                            if (!descriptions[d.key]) return;
                            scope.d = d.values[0].values[0];
                            scope.$apply();
                            ga('send', 'event', 'openModal', d.name || 'root');
                            $modal.open({
                                scope: scope,
                                templateUrl: 'infotemplate'
                            });
                        });

                    newTr.append('td').datum(function (d) {
                        return d.values[0].values[0]
                    })
                        .text(function (d) {
                            return d.name;
                        })
                        .classed('hasChildren', function (d) {
                            return d.hasChildren;
                        })
                        .on('click', function (d) {
                            if (d3.event.defaultPrevented) return;
                            if (d.hasChildren) {
                                scope.filter.code = d.code;
                                scope.$apply();
                            }
                        });
                    newTr.append('td').attr('class', 'number revenue');

                    newTr.append('td').attr('class', 'number expense');

                    tr.select('td.revenue').datum(function (d) {
                        var d = _.find(d.values, function (d) {
                            return d.key == 'revenue';
                        });
                        if (d) {
                            return d.values[0]
                        } else {
                            return {
                                value: '-'
                            }
                        }
                    }).text(function (d) {
                        return d.value ? $filter('swissFormat')(d.value) : '-';
                    });

                    tr.select('td.expense').datum(function (d) {
                        var d = _.find(d.values, function (d) {
                            return d.key == 'expense';
                        });
                        if (d) {
                            return d.values[0]
                        } else {
                            return {
                                value: '-'
                            }
                        }
                    }).text(function (d) {
                        return d.value ? $filter('swissFormat')(d.value) : '-';
                    });

                    tr.exit()
                        .remove();

                }
            }
        }
    }])
    .directive('breadcrumbs', [function () {
        return {
            templateUrl: 'breadcrumbs'
        }
    }])
    .controller('Modal', ['$scope', '$modal', function ($scope, $modal) {
        $scope.open = function (modal) {
            $modal.open({
                templateUrl: modal
            });
        };
    }]);

angular.module('ktbe.filters', [])
    .filter('sum', [function () {
        return function (input, year) {
            return _.reduce(input, function (memo, d) {
                return memo + (d.values[year] || 0);
            }, 0);
        };
    }])
    .filter('swissFormat', [function () {
        return function (input) {
            var result = (Math.round(input * 1000)).toLocaleString("en-US").replace(/,/g, "'").replace('.00', '');
            return isNaN(input) ? '-' : result;
        }
    }])
    .filter('humanReadable', [function () {
        return function (input, index) {
            index = index ? ~~((index) / 3) + 1 : ~~(Math.log(input) * Math.LOG10E / 3);
            var hr = ['', '000', ' Mio.', ' Mrd.', ' Bio.', ' Brd.'];
            if (index > 1) {
                var result = input / Math.pow(1000, index);
                return result.toFixed(2) + hr[index];
            } else {
                return input.toFixed(2);
            }
        }
    }]);

angular.module('ktbe.services', [])
    .service('FinanceService', ['$q', function ($q) {

        function hasChildren(node) {
            if (node.code == '') return true;
            var regexp = new RegExp('^' + node.code + '[0-9]+$');
            return data.some(function (d) {
                return d.code.match(regexp);
            });
        }

        var data;
        if (!data) {
            data = $q(function (resolve, reject) {
                d3.csv('data/descriptions.csv', function (row) {
                    for (var key in row) {
                        if (row.hasOwnProperty(key) && key != 'code' && row[key].match(/^[0-9\.-]+$/)) {
                            row[key] = +row[key];
                        }
                    }
                    return row;
                }, function (descriptions) {

                    descriptions = d3.map(descriptions, function (d) {
                        return d.code;
                    }).entries();

                    d3.csv('data/data.csv', function (row) {
                        for (var key in row) {
                            if (row.hasOwnProperty(key) && key != 'code' && row[key].match(/^[0-9\.-]+$/)) {
                                row[key] = +row[key];
                            }
                        }

                        if (descriptions[row.code]) {
                            row.description = descriptions[row.code].value.Text;
                        }

                        return row;
                    }, function (err, data) {
                        if (err) {
                            reject(err);
                        }
                        resolve(data);
                    });
                });

            });
        }

        return data;

    }])
    .service('DescriptionService', ['$q', function ($q) {
        var data;

        if (!data) {
            data = $q(function (resolve, reject) {
                d3.csv('data/descriptions.csv', function (row) {
                    for (var key in row) {
                        if (row.hasOwnProperty(key) && key != 'code' && row[key].match(/^[0-9\.-]+$/)) {
                            row[key] = +row[key];
                        }
                    }
                    return row;
                }, function (err, data) {
                    if (err) {
                        reject(err);
                    }

                    resolve(data);
                });
            });
        }


        return data;

    }]);