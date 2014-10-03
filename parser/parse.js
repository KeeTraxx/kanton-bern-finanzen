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

var path = require('path');
var util = require('util');
var fs = require('fs');
var kexcel = require('kexcel');

var _ = require('underscore');

var descriptions = {
    "0": "Umfasst den Regierungsrat (Exekutive) und den Grossen Rat (Legislative) inkl. Kommissionen, übrige allgemeine Dienste, welche keiner bestimmten Funktion zugewiesen werden können (wie Direktionssekretariate, Staatskanzlei etc.), Finanz- und Steuerverwaltung sowie Verwaltungsliegenschaften, die keiner bestimmten Funktion zugewiesen werden können.",
    "1": "Umfasst die Polizei, das Strassenverkehrs- und Schifffahrtsamt, die Verkehrssicherheit ohne die Bereiche Luft- und Raumfahrt, die Rechtssprechung, jedoch ohne den Strafvollzug. Weiter sind die Feuerwehr sowie die Verteidigung (militärisch und zivil), ohne militärische Hilfsaktionen, diesem Bereich zugeordnet.",
    "2": "Umfasst die obligatorische Schule, die Sonderschulen ohne zusätzliche ergänzende Leistungen, die berufliche Grundbildung, die höhere Berufsbildung, die Hochschulen und die Forschung, sowie das übrige Bildungswesen, welches keiner der aufgeführten Funktion zugewiesen werden kann.",
    "3": "Umfasst u.a. die Denkmalpflege und den Heimatschutz, Konzert und Theater, Film und Kino, Sport und Freizeit sowie Kirche und religiöse Angelegenheiten.",
    "4": "Umfasst die Funktionen Spitäler, Kranken- und Pflegeheime, die ambulante Krankenpflege sowie die Gesundheitsprävention ohne die soziale Unterstützung von Alkohol- und Drogenabhängigen und die Forschung und Entwicklung in Gesundheit.",
    "5": "Die sozialen Risiken bilden in diesem Aufgabenbereich die Basis. Darin enthalten sind die Prämienverbilligungen, Ergänzungsleistungen, die wirtschaftliche Hilfe sowie das Asylwesen.",
    "6": "Umfasst die Bereiche Strassenverkehr (Strassen), ohne die Verkehrssicherheit und ohne das Strassenverkehrsamt, sowie den öffentlichen Verkehr.",
    "7": "Umfasst die Wasserversorgung, die Abwasserbeseitigung, die Abfallwirtschaft, Gewässerverbauungen und die Raumordnung.",
    "8": "Umfasst die Bereiche Landwirtschaft, Forstwirtschaft, Tourismus, Industrie, Gewerbe, Handel ohne die Regionalen Arbeitsvermittlungszentren und Leistungen an Arbeitslose sowie Brennstoffe und Energie.",
    "9": "Umfasst die Steuern, den Finanz- und Lastenausgleich sowie die Vermögens- und Schuldenverwaltung (z.B. Zinsen)."
};


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
                    childnode = {code: c, values: {} };
                    node.children = node.children || [];
                    node.children.push(childnode);
                }
                childnode.name = sheet.getCellValue(row,6);


                if (descriptions[c]) {
                    childnode.description = descriptions[c];
                }

                childnode.values[year] = parseFloat(sheet.getCellValue(row, 8) ) || 0;
                node = childnode;
                return c;
            },'');
        }

        data.push(yeardata);
    });
    } catch (e) {
        console.log(e);
    }

    /*fs.writeFile(path.join('..','data', 'data.json'), JSON.stringify(data, null, 4), function(){
        console.log('done!');
    });*/

    fs.writeFile(path.join('..','data', 'data.json'), JSON.stringify(nodeData, null, 4), function(){
        console.log('done!');
    });
});