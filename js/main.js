var svg = d3.select('svg#main');

var slider = d3.select('#slider');

var clusters = {};

var color = d3.scale.category20();

var padding = 6, // separation between same-color nodes
    clusterPadding = 18; // separation between different-color nodes

d3.json('data/data.json', function (err, data) {
    var dat = data;

    function showYear(year) {
        var w = svg.style('width');
        var h = svg.style('height');

        var data = _.find(dat, function (d) {
            return d.year == year;
        }).children;

        var max = d3.max(data, function (d) {
            return d.value;
        });

        var scale = d3.scale.sqrt()
            .domain([0, max])
            .range([10, parseInt(h) / 3]);

        var nodes = data.map(function (d) {
            var cluster = d.cluster = d.code;
            d.radius = scale(d.value);
            d.x = 100;
            d.y = 100;
            if (!clusters[cluster] || (d.radius > clusters[cluster].radius)) {
                clusters[cluster] = d;
            }
            return d;
        });


        // Use the pack layout to initialize node positions.
        d3.layout.pack()
            .sort(null)
            .size([w, h])
            .children(function(d) { return d.values; })
            .value(function(d) { return d.radius * d.radius; })
            .nodes({values: d3.nest()
                .key(function(d) { return d.cluster; })
                .entries(nodes)});

        var force = d3.layout.force()
            .nodes(nodes)
            .size([w, h])
            .gravity(0.02)
            .charge(0)
            .on("tick", tick)
            .start();


        var node = svg.selectAll("circle")
            .data(nodes)
            .enter().append("circle")
            .style("fill", function (d) {
                return color(d.cluster);
            })
            .call(force.drag);

        node.transition()
            .duration(750)
            .delay(function(d, i) { return i * 5; })
            .attrTween("r", function(d) {
                var i = d3.interpolate(0, d.radius);
                return function(t) { return d.radius = i(t); };
            });


        function tick(e) {
            node
                //.each(cluster(10 * e.alpha * e.alpha))
                //.each(collide(0.5))
                .attr("cx", function (d) {
                    return d.x;
                })
                .attr("cy", function (d) {
                    return d.y;
                });
        }

// Move d to be adjacent to the cluster node.
        function cluster(alpha) {
            return function(d) {
                var cluster = clusters[d.cluster];
                if (cluster === d) { return; }
                var x = d.x - cluster.x,
                    y = d.y - cluster.y,
                    l = Math.sqrt(x * x + y * y),
                    r = d.radius + cluster.radius;
                if (l !== r) {
                    l = (l - r) / l * alpha;
                    d.x -= x *= l;
                    d.y -= y *= l;
                    cluster.x += x;
                    cluster.y += y;
                }
            };
        }

        // Resolves collisions between d and all other circles.
        function collide(alpha) {
            var quadtree = d3.geom.quadtree(nodes);
            return function(d) {
                var r = d.radius + Math.max(padding, clusterPadding),
                    nx1 = d.x - r,
                    nx2 = d.x + r,
                    ny1 = d.y - r,
                    ny2 = d.y + r;
                quadtree.visit(function(quad, x1, y1, x2, y2) {
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


    }

    var minYear = d3.min(data, function (d) {
        return d.year
    });
    var maxYear = d3.max(data, function (d) {
        return d.year
    });
    var sliderConf = d3.slider().min(minYear).max(maxYear).axis(true).step(1).value(maxYear).on('slide', function (e, value) {
        showYear(value);
    });
    slider.call(sliderConf);
    showYear(maxYear);
});
