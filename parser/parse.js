var path = require('path');
var util = require('util');
var fs = require('fs');
var kexcel = require('kexcel');

var _ = require('underscore');

kexcel.open(path.join('input','input.xlsx'), function(err, workbook){
    var data = [];
    try {
    _.each(workbook.sheets, function(sheet){
        var yeardata = {children:[]};
        yeardata.year = parseInt( sheet.name );
        console.log(sheet.name);
        console.log(sheet.getCellValue(2,2));

        for(var row = 7; sheet.getCellValue(row,2); row++) {
            var code = sheet.getCellValue(row,5);
            var node = yeardata;
            _.reduce(code, function(memo, d){
                var c = memo+d;
                console.log('Looking for ', c);
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

        data.push(yeardata);
    });
    } catch (e) {
        console.log(e);
    }
    //console.log(util.inspect(data, {showHidden: false, depth: null}));
    fs.writeFile(path.join('..','data', 'data.json'), JSON.stringify(data, null, 4), function(){
        console.log('done!');
    });
});