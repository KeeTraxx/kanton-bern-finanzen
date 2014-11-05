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
    'ktbe.filters'
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
    .controller('VisualizationController', ['$scope', '$http', '$location', '$routeParams', '$timeout', function ($scope, $http, $location, $routeParams, $timeout) {
        $scope.color = function (input) {
            var c = d3.scale.category10().domain(d3.range(0, 10));
            var base = d3.hsl(c(input[0]));
            base.h += +( input[1] || 0 ) * 5;
            base.s += +( input[1] || 0 ) / 20;
            base.l += +( input[1] || 0 ) / 30;
            return base;
        };
        $http.get('data/data.json').success(function (data) {
            $scope.data = data;
            $scope.selectedCode = $routeParams.code || null;
            var n = $scope.findRecursive($scope.selectedCode);
            ga('send', 'event', 'direct', n ? n.name : 'root');
        });

        $scope.$watch('selectedCode', function (code) {
            if (code) {
                $scope.selectedNode = $scope.findRecursive($scope.data, code);
            } else {
                $scope.selectedNode = $scope.data;
            }
        });

        $scope.findRecursive = function (nodes, code) {
            var node = nodes;

            _.reduce(code, function (memo, d) {
                var c = memo + d;
                node = _.find(node.children, function (d) {
                    return d.code == c;
                });
                return c;
            }, '');

            return node;
        };

        $scope.$watch('selectedYear', updateUrl);
        $scope.$watch('selectedCode', updateUrl);

        function updateUrl() {
            $location.path($scope.selectedYear + '/' + ($scope.selectedCode || ''), false);
        }

    }]);

angular.module('ktbe.directives', ['ui.bootstrap'])
    .directive('slider', ['$routeParams', function ($routeParams) {
        return {
            restrict: 'A',
            link: function (scope, el) {
                scope.$watch('data', function (data) {
                    if (data) {
                        var extent = d3.extent(_.keys(data.children[0].values));
                        var sliderConf = d3.slider().min(extent[0]).max(extent[1]).axis(true).step(1).value($routeParams.year || extent[1]).on('slide', function (e, value) {
                            scope.selectedYear = value;
                            scope.$apply();
                        });
                        scope.selectedYear = $routeParams.year != 'undefined' ? $routeParams.year : extent[1];
                        d3.select(el[0]).call(sliderConf);
                    }
                });
            }
        }
    }])
    .directive('visualization', ['$window', '$filter', function ($window, $filter) {
        return {
            restrict: 'A',
            link: function (scope, el) {
                var svg = d3.select(el[0]);
                var force = d3.layout.force()
                    .gravity(0.05)
                    .on('tick', tick);

                var padding = 6, // separation between same-color nodes
                    clusterPadding = 18; // separation between different-color nodes

                var nodes = [];
                scope.$watch('selectedYear', update);
                scope.$watch('selectedNode', update);

                scope.$watch('hover', function (node) {
                    svg.selectAll('circle.border')
                        .transition()
                        .style('stroke-width', 2);

                    var g = svg.selectAll('g.node')
                        .filter(function (d) {
                            return d == node;
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
                    return d.name;
                });
                svg.call(tip);
                svg.on('click', function () {
                    if (scope.selectedCode && d3.event.target == this) {
                        var parent = scope.selectedCode.substr(0, scope.selectedCode.length - 1);
                        scope.selectedCode = scope.selectedCode.length > 0 ? parent : scope.selectedCode;
                        scope.$apply();
                        ga('send', 'event', 'parent', scope.selectedNode.name || 'root');
                    }
                });
                function tick(e) {
                    d3.selectAll('g.node')
                        .each(collide(0.3, nodes))
                        .attr("transform", function (d) {
                            return 'translate(' + d.x + ',' + d.y + ')';
                        });
                }

                function collide(alpha) {
                    var quadtree = d3.geom.quadtree(nodes);
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

                // Reference circles
                svg.append('g').attr('class', 'reference');

                // Nodes
                var nodesG = svg.append('g')
                    .attr('class', 'nodes');

                function update() {
                    // do nothing if there is no year and node
                    if (!( scope.selectedYear && scope.selectedNode )) return;

                    var height = parseInt(svg.style('height'));
                    var width = parseInt(svg.style('width'));

                    var node = scope.selectedNode;

                    var max = d3.max(node.children, function (d) {
                        return d.values[scope.selectedYear];
                    });

                    var scale = d3.scale.sqrt()
                        .domain([0, max])
                        .range([1, height / 6]);

                    nodes = _.each(node.children, function (d) {
                        d.radius = d.values[scope.selectedYear] ? scale(d.values[scope.selectedYear]) : 0;
                    });

                    var max = d3.max(nodes, function (d) {
                        return d.values[scope.selectedYear];
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
                        .nodes(nodes)
                        .size([width, height])
                        .start();

                    var nodeG = nodesG
                        .selectAll('g.node')
                        .data(nodes, function (d) {
                            return d.code;
                        });

                    nodeG.exit()
                        .transition()
                        .attr('transform', 'scale(0)')
                        .remove();

                    var g = nodeG.enter()
                        .append('g')
                        .attr('class', 'node')
                        .classed('hasChildren', function(d){
                            return d.children && d.children.length > 0;
                        })
                        .on('click', function (d) {
                            if (d3.event.defaultPrevented) return;
                            var children = _.filter(d.children, function (d) {
                                return d.values[scope.selectedYear] > 0;
                            });
                            if (children.length > 1) {
                                scope.selectedCode = d.code;
                                scope.$apply();
                                ga('send', 'event', 'bubbleClick', scope.selectedNode.name || 'root');
                            }
                        });

                    g.append('g').attr('class', 'bear').append('use')
                        .attr('xlink:href', '#bear')
                        .attr('opacity', 0.2);

                    g
                        .append('circle')
                        .attr('class', 'backdrop')
                        .attr('fill', function (d) {
                            return scope.color(d.code);
                        })
                        .style('opacity', 0.4)
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
                            return scope.color(d.code);
                        })
                        .style('stroke-width', 2)
                        .style('opacity', 0.6);

                    g.append('text')
                        .text(function(d){
                            return $filter('humanReadable')( d.values[scope.selectedYear] * 1000, maxLog);
                        });

                    nodeG.select('text')
                        .attr('transform', function (d) {
                            return 'scale(' + d.radius / 50 + ')';
                        });

                    nodeG.selectAll('circle')
                        .attr('r', function (d) {
                            return d.radius
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
    }])
    .directive('financeTable', ['$filter', '$modal', function ($filter, $modal) {
        return {
            restrict: 'A',
            link: function (scope, el) {
                scope.$watch('selectedNode', update);
                scope.$watch('selectedYear', update);

                var table = d3.select(el[0]);

                scope.$watch('hover', function (node) {
                    table.selectAll('tbody tr').classed('info', false);
                    var tr = table.selectAll('tbody tr').filter(function (d) {
                        return node == d;
                    }).classed('info', true);
                });

                function update() {
                    if (!(  scope.selectedYear && scope.selectedNode )) return;

                    var filtered = _.filter(scope.selectedNode.children, function (d) {
                        return d.values[scope.selectedYear] > 0;
                    });

                    var tr = table.select('tbody').selectAll('tr').data(filtered, function (d) {
                        return d.code;
                    });

                    var total = $filter('sum')(filtered, scope.selectedYear);

                    var newTr = tr.enter()
                        .append('tr')
                        .on('mouseover', function (d) {
                            scope.hover = d;
                            scope.$apply();
                        })
                        .on('mouseout', function (d) {
                            scope.hover = null;
                            scope.$apply();
                        });

                    var td = newTr.append('td')
                        .attr('class', 'infocol')
                        .html(function(d){
                            return d.description ? '<i class="fa fa-info-circle"></i>' : '<i class="fa fa-circle"></i>';
                        })
                        .style('color', function (d) {
                            return scope.color(d.code);
                        })
                        .on('click', function (d) {
                            if (!d.description) return;
                            scope.d = d;
                            scope.$apply();
                            ga('send', 'event', 'openModal', d.name || 'root');
                            $modal.open({
                                scope: scope,
                                templateUrl: 'infotemplate'
                            });
                        });

                    newTr.append('td')
                        .text(function (d) {
                            return d.name
                        })
                        .classed('hasChildren', function(d) {
                            return d.children && d.children.length > 0;
                        })
                        .on('click', function (d) {
                            if (d3.event.defaultPrevented) return;
                            var children = _.filter(d.children, function (d) {
                                return d.values[scope.selectedYear] > 0;
                            });

                            if (children.length > 1) {
                                scope.selectedCode = d.code;
                                scope.$apply();
                                ga('send', 'event', 'tableClick', scope.selectedNode.code || 'root');
                            }
                        });
                    newTr.append('td');
                    newTr.append('td');

                    tr.select('td:nth-child(3)')
                        .attr('class', 'number')
                        .text(function (d) {
                            return d.values[scope.selectedYear] ? $filter('swissFormat')(d.values[scope.selectedYear]) : '-';
                        });

                    tr.select('td:nth-child(4)')
                        .attr('class', 'number')
                        .text(function (d) {
                            return d.values[scope.selectedYear] ? $filter('number')(d.values[scope.selectedYear] / total * 100, 2) + '%' : '0%';
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
            return (Math.round(input * 1000)).toLocaleString("en-US").replace(/,/g, "'").replace('.00', '');
        }
    }])
    .filter('humanReadable', [function () {
        return function (input, index) {
            index = index ? ~~((index) / 3)+1 : ~~(Math.log(input) * Math.LOG10E / 3);
            var hr = ['', '000', ' Mio.', ' Mrd.', ' Bio.', ' Brd.'];
            if (index > 1) {
                var result = input / Math.pow(1000, index);
                return result.toFixed(2) + hr[index];
            } else {
                return input.toFixed(2);
            }
        }
    }]);