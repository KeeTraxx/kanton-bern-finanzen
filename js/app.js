angular.module('ktbe', [
    'ngRoute',
    'ktbe.controllers',
    'ktbe.directives'
])
    .config(['$routeProvider', function ($routeProvider) {
        $routeProvider.when('/:year/:code?', {templateUrl: 'index', controller: 'VisualizationController'});
        $routeProvider.otherwise({redirectTo: '/2013'})
    }]);

angular.module('ktbe.controllers', [])
    .controller('VisualizationController', ['$scope', '$http', function ($scope, $http) {
        $http.get('data/data2.json').success(function (data) {
            $scope.data = data;
        });
    }]);

angular.module('ktbe.directives', [])
    .directive('slider', ['$routeParams', function ($routeParams) {
        return {
            restrict: 'A',
            link: function (scope, el) {
                scope.selectedCode = $routeParams.code;
                scope.$watch('data', function (data) {
                    if (data) {
                        console.log(data);
                        var extent = d3.extent(_.keys(data.children[0].values));
                        var sliderConf = d3.slider().min(extent[0]).max(extent[1]).axis(true).step(1).value($routeParams.year).on('slide', function (e, value) {
                            scope.selectedYear = value;
                            scope.$apply();
                        });
                        scope.selectedYear = $routeParams.year;
                        d3.select(el[0]).call(sliderConf);
                    }
                });
            }
        }
    }])
    .directive('visualization', ['$window', function ($window) {
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
                $($window).on('resize', update);
                var tip = d3.tip().attr('class', 'd3-tip').html(function (d) {
                    return d.name;
                });
                svg.call(tip);
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

                function findRecursive(nodes, code) {
                    var node = null;

                    _.reduce(code, function (memo, d) {
                        var c = memo + d;
                        node = _.find(nodes, function (d) {
                            return d.code == c
                        });
                        return c;
                    }, '');

                    return node;
                }

                function update() {
                    // do nothing if there is no year and node
                    if (!scope.selectedYear) return;
                    console.log('update', scope.selectedYear);

                    var height = parseInt(svg.style('height'));
                    var width = parseInt(svg.style('width'));

                    var node = scope.data;

                    if (scope.selectedCode) {
                        node = findRecursive(data.children, scope.selectedCode);
                    }

                    var max = d3.max(node.children, function (d) {
                        return d.values[scope.selectedYear];
                    });

                    var scale = d3.scale.sqrt()
                        .domain([0, max])
                        .range([10, height / 6]);


                    nodes = _.each(node.children, function (d) {
                        d.radius = scale(d.values[scope.selectedYear]);
                    });

                    force
                        .nodes(nodes)
                        .size([width, height])
                        .start();

                    var nodeG = svg.selectAll('g.node').data(nodes, function (d) {
                        return d.code
                    });

                    var color = d3.scale.category10();

                    nodeG.exit()
                        .transition()
                        .attr('transform', 'scale(0)')
                        .remove();

                    var g = nodeG.enter()
                        .append('g')
                        .attr('class', 'node');

                    g.append('use')
                        .attr('xlink:href', '#bear')
                        .attr('opacity', 0.2);

                    g
                        .append('circle')
                        .attr('class', 'backdrop')
                        .attr('fill', function (d) {
                            return color(d.code[0]);
                        })
                        .style('opacity', 0.4)
                        .on('mouseover', tip.show)
                        .on('mouseout', tip.hide);



                    g.append('circle')
                        .attr('fill', 'none')
                        .style('stroke', function(d){
                            return color(d.code[0]);
                        })
                        .style('stroke-width', 2)
                        .style('opacity', 0.6);

                    nodeG.call(force.drag);

                    nodeG.selectAll('circle')
                        .transition()
                        .attr('r', function (d) {
                            return d.radius
                        });

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
                        })

                }
            }
        }
    }]);