function drawClusterForceLayout(data) {
    var svg = d3.select('svg#main');
    var width = parseInt(svg.style('width')),
        height = parseInt(svg.style('height')),
        padding = 6, // separation between same-color nodes
        clusterPadding = 18; // separation between different-color nodes

    var color = d3.scale.category20();

    // The largest node for each cluster.
    var clusters = {};

    var max = d3.max(data, function (d) {
        return d.value
    });

    var scale = d3.scale.sqrt()
        .domain([0, max ])
        .range([10, height / 5]);

    // custom data
    var nodes = data.map(function (d) {
        var cluster = d.cluster = d.code;
        //var total = d.arbeitstitel.length;
        d.radius = scale(d.value);
        if (!clusters[cluster] || (d.radius > clusters[cluster].radius)) {
            clusters[cluster] = d;
        }
        return d;
    });

    // Use the pack layout to initialize node positions.
    d3.layout.pack()
        .sort(null)
        .size([width, height])
        .children(function (d) {
            return d.values;
        })
        .value(function (d) {
            return d.radius * d.radius;
        })
        .nodes({values: d3.nest()
            .key(function (d) {
                return d.cluster;
            })
            .entries(nodes)});


    function tick(e) {
        node
            .each(cluster(10 * e.alpha * e.alpha))
            .each(collide(0.5))
            .attr("cx", function (d) {
                return d.x;
            })
            .attr("cy", function (d) {
                return d.y;
            });
    }

    var force = d3.layout.force()
        .nodes(nodes)
        .size([width, height])
        .gravity(0.02)
        .charge(0)
        .on("tick", tick)
        .start();

    var svg = d3.select("body").select("svg")
        .attr("width", width)
        .attr("height", height);

    var nodeData = svg.selectAll("circle")
        .data(nodes);

    var node = nodeData
        .enter().append("circle")
        .style("fill", function (d) {
            return color(d.cluster);
        })
        .call(force.drag);

    nodeData.exit().remove();

    node.transition()
        .duration(750)
        .delay(function (d, i) {
            return i * 100;
        })
        .attrTween("r", function (d) {
            var i = d3.interpolate(0, d.radius);
            return function (t) {
                return d.radius = i(t);
            };
        });

    // Move d to be adjacent to the cluster node.
    function cluster(alpha) {
        return function (d) {
            var cluster = clusters[d.cluster];
            if (cluster === d) {
                return;
            }
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

}

d3.json('data/data.json', function (err, data) {
    var minYear = d3.min(data, function (d) {
        return d.year
    });
    var maxYear = d3.max(data, function (d) {
        return d.year
    });
    var sliderConf = d3.slider().min(minYear).max(maxYear).axis(true).step(1).value(maxYear).on('slide', function (e, value) {
        console.log(value);
        var d = _.find(data, function(d){return d.year == value}).children;
        drawClusterForceLayout(d);
    });
    d3.select('#slider').call(sliderConf);
    drawClusterForceLayout(_.find(data, function(d){return d.year == maxYear}).children);
});