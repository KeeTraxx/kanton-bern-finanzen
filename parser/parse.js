var path = require('path');
var util = require('util');
var fs = require('fs');
var kexcel = require('kexcel');

var _ = require('underscore');

kexcel.open(path.join('input','input.xlsx'), function(err, workbook){
    var data = [];
    var nodeData = {};
    try {
    _.each(workbook.sheets, function(sheet){
        var yeardata = {children:[]};
        yeardata.year = parseInt( sheet.name );



        var year = yeardata.year;
        console.log(sheet.name);
        console.log(sheet.getCellValue(2,2));

        for(var row = 7; sheet.getCellValue(row,2); row++) {
            var code = sheet.getCellValue(row,5);
            var node = yeardata;
            _.reduce(code, function(memo, d){
                var c = memo+d;
                //console.log('Looking for ', c);
                var childnode = _.find(node.children, function(n) {return n.code == c;});
                if (!childnode) {
                    childnode = {code: c, name: sheet.getCellValue(row,6), value: parseInt(sheet.getCellValue(row, 8) ) || 0 };
                    node.children = node.children || [];
                    node.children.push(childnode);
                }
                node = childnode;
                return c;
            },'');
        }

        console.log(year);

        for(row = 7; sheet.getCellValue(row,2); row++) {
            code = sheet.getCellValue(row,5);
            node = nodeData;
            _.reduce(code, function(memo, d){
                var c = memo+d;
                //console.log('Looking for ', c);
                var childnode = _.find(node.children, function(n) {return n.code == c;});
                if (!childnode) {
                    childnode = {code: c, name: sheet.getCellValue(row,6), values: {} };
                    node.children = node.children || [];
                    node.children.push(childnode);
                }
                childnode.values[year] = parseInt(sheet.getCellValue(row, 8) ) || 0;
                node = childnode;
                return c;
            },'');
        }

        data.push(yeardata);
    });
    } catch (e) {
        console.log(e);
    }

    fs.writeFile(path.join('..','data', 'data.json'), JSON.stringify(data, null, 4), function(){
        console.log('done!');
    });

    fs.writeFile(path.join('..','data', 'data2.json'), JSON.stringify(nodeData, null, 4), function(){
        console.log('done!');
    });
});