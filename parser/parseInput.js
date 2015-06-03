var Promise = require('bluebird');
var kexcel = require('kexcel');
var path = require('path');
var _ = require('lodash');
var fs = require('fs');
var output = fs.createWriteStream('output.csv');

kexcel.open(path.join(__dirname, '..', 'input', 'von_EFV_ ktn_be.xlsx'), function (err, workbook) {

    output.write('type,year,code,name,value\n');


    var revenuesheet = _.find(workbook.sheets, function(d){
        return d.name == 'einnahmen_funk';
    });

    var rowData;
    for(var rowNum=8;rowData=revenuesheet.getRowValues(rowNum);rowNum++) {
        //console.log(rowData);
        //console.log(rowData);
        var code = rowData[1];
        _.each(rowData, function(value, i) {
            //console.log(i);
            if (i < 3) return;
            if (!rowData[i]) return;
            var year = revenuesheet.getCellValue(7,i);
            output.write([
                'revenue',
                year,
                code,
                rowData[2],
                rowData[i]
            ].join(',') + '\n')
        });
    }

    var expenseSheet = _.find(workbook.sheets, function(d){
        return d.name == 'ausgaben_funk';
    });


    for(rowNum=8;rowData=expenseSheet.getRowValues(rowNum);rowNum++) {
        //console.log(rowData);
        //console.log(rowData);
        code = rowData[1];
        _.each(rowData, function(value, i) {
            //console.log(i);
            if (i < 3) return;
            if (!rowData[i]) return;
            var year = expenseSheet.getCellValue(7,i);
            output.write([
                    'expense',
                    year,
                    code,
                    rowData[2],
                    rowData[i]
                ].join(',') + '\n')
        });
    }

    //output.close();

    //console.log(incomesheet);

});
