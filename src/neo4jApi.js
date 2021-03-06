//require('file-loader?name=[name].[ext]!../../node_modules/neo4j-driver/lib/browser/neo4j-web.min.js');
//require('../../node_modules/neo4j-driver/lib/browser/neo4j-web.min.js')
let neo4j = require('neo4j-driver');

//Call of models file to stock responses from database.
// var Processes = require('./models/Processes');
// var Analysis = require('./models/Analysis')
// var DLStructuredDataset = require('./models/DLStructuredDataset')
// var Operation = require('./models/Operation')
// var Quality = require('./models/Quality')
// var QualityValue = require('./models/QualityValue')
// var Study = require('./models/Study')
// var Landmarker = require('./models/Landmarker')
// var Parameter = require('./models/Parameter')
// var ParameterSettings = require('./models/ParameterSettings')
// var Evaluation = require('./models/Evaluation')
// var NominalFeature = require('./models/NominalFeature')
// var NumericFeature = require('./models/NumericFeature')
// var NominalAttribute = require('./models/NominalAttribute')
// var NumericAttribute = require('./models/NumericAttribute')
// var EntityClass = require('./models/EntityClass')
// var RelationshipDS = require('./models/RelationshipDS')
// var AnalysisDSRelationship = require('./models/AnalysisDSRelationship')
// var RelationshipAtt = require('./models/RelationshipAtt')
// var Attribute = require('./models/Attribute')
// var AnalysisAttribute = require('./models/AnalysisAttribute')
// var AlgoResult = require('./models/AlgoResult')
// var Nodes = require('./models/Nodes')
// var Relationship = require('./models/Relationship')
// var Tag = require('./models/Tag')

//Drivers and parameters to acces database 
var _ = require('lodash');
//var neo4j = global.neo4j.v1;
const fs = require('fs');
const path = require('path');

let pwd = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../store-password.json')));
console.log(pwd)
var driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", pwd.password));
//Function to search processus metadata with parameters to apply filter. 
//Attributed values are default value if no parameter is given.
function getProcesses(tags, language = "", date = "0001-01-01", typeOpe = [], exeEnv = []) {
  var session = driver.session();
  //Classic query without filter, search with name, description and tag name.
  var query = "MATCH (p:Process) OPTIONAL MATCH (p)-[r:hasTag]->(t :Tag) OPTIONAL MATCH (o:Operation)-[:isUsedBy]->(:OperationOfProcess)<-[:containsOp]-(p) WITH p,t,o WHERE ("
  for (var i = 0; i < tags.length; i++) {
    if (i != tags.length - 1) {
      query = query + "toLower(t.name) CONTAINS toLower('" + tags[i] + "') OR toLower(p.name) CONTAINS toLower('" + tags[i] + "') OR toLower(p.description) CONTAINS toLower('" + tags[i] + "') OR toLower(o.name) CONTAINS toLower('" + tags[i] + "') OR "
    }
    else {
      query = query + "toLower(t.name) CONTAINS toLower('" + tags[i] + "') OR toLower(p.name) CONTAINS toLower('" + tags[i] + "') OR toLower(p.description) CONTAINS toLower('" + tags[i] + "') OR toLower(o.name) CONTAINS toLower('" + tags[i] + "') )"
    }
  }
  //Cypher query for language filter
  if (language.length > 0) {
    query += " AND ("
    for (var i = 0; i < language.length; i++) {
      if (i != language.length - 1) {
        query += " p.programLanguage CONTAINS ('" + language[i] + "') OR "
      } else {
        query += " p.programLanguage CONTAINS ('" + language[i] + "') ) "
      }
    }
  }
  //Cypher query for execution environment
  if (exeEnv.length > 0) {
    query += " AND ("
    for (var i = 0; i < exeEnv.length; i++) {
      if (i != exeEnv.length - 1) {
        query += " p.executionEnvironment CONTAINS ('" + exeEnv[i] + "') OR "
      } else {
        query += " p.executionEnvironment CONTAINS ('" + exeEnv[i] + "') ) "
      }
    }
  }
  //Cypher query for dates filter
  query = query + ' AND (datetime(p.creationDate) >= datetime("' + date + '"))'
  //Cypher query for used operation filter
  if (typeOpe.length > 0) {
    query += " AND (p)-[]-()-[]-(o:Operation) AND ("
    for (var i = 0; i < typeOpe.length; i++) {
      if (i != typeOpe.length - 1) {
        query += " o.name CONTAINS ('" + typeOpe[i] + "') OR "
      } else {
        query += " o.name CONTAINS ('" + typeOpe[i] + "') )"
      }
    }
  }
  query = query + " RETURN distinct p"
  console.log('process ' + query)
  // Query return is kept and stocked within a model with the same name to avoid confusion. Note that only one parameter of return can be stocked.
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new Processes(record.get('p'));
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to search study metadata
function getStudies(tags, type, creationdate = '0001-01-01', landmarker, algoNames, parameter = [], evaluation = [],omNames) {
  var session = driver.session();
  console.log('heho'  + evaluation)
  let typeRech = Object.values(type);
  if (typeRech.indexOf('machineLearning') != -1) {
    console.log(typeRech.indexOf('machineLearning'))
    typeRech.splice(typeRech.indexOf('machineLearning'), 1)
  }
  if (typeRech.indexOf('otherAnalysis') != -1) {
    typeRech.splice(typeRech.indexOf('otherAnalysis'), 1)
  }
  //Classic cypher query to search for study without filter.
  var query = "MATCH (s:Study)-[:hasAnalysis]->(a:Analysis),(l:Landmarker),(al)" 
  if(parameter.length > 0){
    query+= ',(p)'
  }
  if(evaluation.length > 0){
    query+= ',(e)'
  }
  query += "WHERE ("
  for (var i = 0; i < tags.length; i++) {
    if (i != tags.length - 1) {
      query = query + "toLower(s.name) CONTAINS toLower('" + tags[i] + "') OR toLower(s.description) CONTAINS toLower('" + tags[i] + "') OR toLower(a.name) CONTAINS toLower('" + tags[i] + "') OR "
    }
    else {
      query = query + "toLower(s.name) CONTAINS toLower('" + tags[i] + "') OR toLower(s.description) CONTAINS toLower('" + tags[i] + "') OR toLower(a.name) CONTAINS toLower('" + tags[i] + "') )"
    }
  }
  //Cypher query for analysis type filter
  if (typeRech.length > 0) {
    query += ' AND ('
    for (var i = 0; i < typeRech.length; i++) {
      console.log(typeRech[i])
      console.log("c'est pass??")
      if (i != typeRech.length - 1) {
        query += ' toLower(a.typeAnalysis) CONTAINS toLower("' + typeRech[i] + '") OR '
      } else {
        query += ' toLower(a.typeAnalysis) CONTAINS toLower("' + typeRech[i] + '")  )'
      }
    }
  }
  //Cypher query for landmarkers query
  if (landmarker.length > 0) {
    query += ' AND (s)-[:hasAnalysis]->(a)-[:hasImplementation]->(l) AND ('
    for (var i = 0; i < landmarker.length; i++) {
      if (i != landmarker.length - 1) {
        query += ' toLower(l.name) CONTAINS toLower("' + landmarker[i] + '") OR toLower(l.description) CONTAINS toLower("' + landmarker[i] + '") OR '
      } else {
        query += ' toLower(l.name) CONTAINS toLower("' + landmarker[i] + '") OR toLower(l.description) CONTAINS toLower("' + landmarker[i] + '") )'
      }
    }
  }

  if(evaluation.length > 0){
    query += ' AND (s)-[:hasAnalysis]->(a)-[:evaluateAnalysis]-()-[]-(e:EvaluationMeasure) AND ( '
    for (var i = 0; i < evaluation.length; i++) {
      if (i != evaluation.length - 1) {
        query += ' toLower(e.name) CONTAINS toLower("' + evaluation[i] + '") OR '
      } else {
        query += ' toLower(e.name) CONTAINS toLower("' + evaluation[i] + '") )'
      }
    }
  }

  if(parameter.length > 0){
    query += ' AND (s)-[:hasAnalysis]->(a)-[:hasImplementation]->()-[:hasParameter]-(p:Parameter) AND ( '
    for (var i = 0; i < parameter.length; i++) {
      if (i != parameter.length - 1) {
        query += ' toLower(p.name) CONTAINS toLower("' + parameter[i] + '") OR '
      } else {
        query += ' toLower(p.name) CONTAINS toLower("' + parameter[i] + '") )'
      }
    }
  }
  //Cypher query for algo filter. The database does not have all the algo type implemented so this part of query is commented.
  if (algoNames.length > 0 || type.includes('algosupervised') || type.includes('algoUnsupervised') || type.includes('AlgoReinforcement')) {
    query += ' AND (s)-[:hasAnalysis]->(a)-[:hasImplementation]->()-[:usesAlgo]->(al) '
    if (type.includes('algosupervised') || type.includes('algoUnsupervised') || type.includes('AlgoReinforcement')) {
      query += 'AND ('
      if (!type.includes("algosupervised") && !type.includes("algoUnsupervised") && !type.includes("AlgoReinforcement")) {
        query += " al:AlgoSupervised OR al:AlgoUnsupervised OR al:AlgoReinforcement ";
      } else {
        if (type.includes("algosupervised") && type.includes("algoUnsupervised") && type.includes("AlgoReinforcement")) {
          query += " al:AlgoSupervised OR al:AlgoUnsupervised OR al:AlgoReinforcement ";
        } else {
          if (type.includes("algosupervised") && type.includes("algoUnsupervised")) {
            query += " al:AlgoSupervised OR al:AlgoUnsupervised ";
          } else {
            if (type.includes("algosupervised") && type.includes("AlgoReinforcement")) {
              query += " al:AlgoSupervised OR al:AlgoReinforcement ";
            } else {
              if (type.includes("algoUnsupervised") && type.includes("AlgoReinforcement")) {
                query += " al:AlgoUnsupervised OR al:AlgoReinforcement ";
              } else {
                if (type.includes("algoUnsupervised")) {
                  query = query + "al:AlgoUnsupervised";
                } else {
                  if (type.includes("AlgoReinforcement")) {
                    query = query + "al:AlgoReinforcement ";
                  } else {
                    if (type.includes("algosupervised")) {
                      query = query + "al:AlgoSupervised";
                    }
                  }
                }
              }
            }
          }
        }
      }
      query += ') '
    }
    //Cypher query to search a particular algo names.
    if (algoNames.length > 0) {
      query += ' AND (toLower(al.name) CONTAINS toLower("' + algoNames + '") OR toLower(al.description) CONTAINS toLower("' + algoNames + '") ) '
    }
  }

  //Cyper query for output models filter, they are not implemented in the database.
  // if(omNames>0){
  //   query += ' AND (s)-[:hasAnalysis]->(a)-[:hasOutputModel]->(opm:OutputModel) AND opm.name CONTAINS "' + omNames + '"';
  // }
  query = query + ' AND (datetime(s.creationDate) >= datetime("' + creationdate + '"))'
  query = query + " RETURN DISTINCT s"
  console.log('Studies ' + query)
  //We get only study here, which are used later to get analysis
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new Study(record.get('s'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to search for analysis metadata by study id or analysis
function getAnalyses(study, name, id) {
  var session = driver.session();
  //partie cypher de base pour r??cup??rer les analyses
  //Classic cypher request to get analysis 
  var query = `MATCH (s:Study)-[r:hasAnalysis]->(a:Analysis)
  OPTIONAL MATCH (a)-[]-(l:Landmarker)
  OPTIONAL MATCH (a)-[]-(i:Implementation)
  with s,a,i,l
  WHERE`
  //Cypher query if the input is Study
  if (study.length > 0) {
    query = query + " toLower(s.name) CONTAINS toLower('" + study + "') "
  } else { // Cypher query if the input is an analysis
    if (name.length > 0) {
      query = query + " toLower(a.name) CONTAINS toLower('" + name + "') AND a.uuid = '" + id + "'"

    }
  }
  query = query + " RETURN DISTINCT a,i,l"
  console.log('heyo' + query)
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return [new Analysis(record.get('a')), new Landmarker(record.get('i') || record.get('l'))]
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get nominal features by analysis
function getNominalFeaturesbyAnalysis(analyseId) {
  var session = driver.session();
  query = 'Match (nf:AnalysisNominalFeatures),(f:AnalysisFeatures),(a:Analysis) WHERE a.uuid = "' + analyseId + '"  AND (a)-[:hasFeaturesAnalysis]->(f)-[:hasNominalFeaturesAnalysis]->(nf) RETURN nf'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new NominalFeature(record.get('nf'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get numeric features by analysis
function getNumericFeaturesbyAnalysis(analyseId) {
  var session = driver.session();
  query = 'Match (nf:AnalysisNumericFeatures),(f:AnalysisFeatures),(a:Analysis) WHERE a.uuid = "' + analyseId + '"  AND (a)-[:hasFeaturesAnalysis]->(f)-[:hasNumericFeaturesAnalysis]->(nf) RETURN nf'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new NumericFeature(record.get('nf'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get numeric attributes by analysis
function getNumericAttributebyAnalysis(analyseId) {
  var session = driver.session();
  query = 'Match (na:NumericAttribute),(nf:AnalysisNumericFeatures),(f:AnalysisFeatures),(a:Analysis),(ta:AnalysisTarget) WHERE a.uuid = "' + analyseId + '"  AND ((a)-[:hasFeaturesAnalysis]->(f)-[:hasNumericFeaturesAnalysis]->(nf)-[:hasFeatures]->(na) OR (a)-[:hasTargetAnalysis]->(ta)-[:hasTarget]->(na)) RETURN DISTINCT na'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new NumericAttribute(record.get('na'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get nominal attributes by analysis
function getNominalAttributebyAnalysis(analyseId) {
  var session = driver.session();
  query = 'Match (na:NominalAttribute),(nf:AnalysisNominalFeatures),(f:AnalysisFeatures),(a:Analysis),(ta:AnalysisTarget) WHERE a.uuid = "' + analyseId + '"  AND ((a)-[:hasFeaturesAnalysis]->(f)-[:hasNominalFeaturesAnalysis]->(nf)-[:hasFeatures]->(na) OR (a)-[:hasTargetAnalysis]->(ta)-[:hasTarget]->(na)) RETURN DISTINCT na'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new NominalAttribute(record.get('na'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get a specific nominal attribute by analysis
function getNominalAttribute(name, analyseId) {
  var session = driver.session();
  query = 'Match (na:NominalAttribute),(nf:AnalysisNominalFeatures),(f:AnalysisFeatures),(a:Analysis),(ta:AnalysisTarget) WHERE a.uuid = "' + analyseId + '"  AND na.name= "' + name + '" AND ((a)-[:hasFeaturesAnalysis]->(f)-[:hasNominalFeaturesAnalysis]->(nf)-[:hasFeatures]->(na) OR (a)-[:hasTargetAnalysis]->(ta)-[:hasTarget]->(na)) RETURN DISTINCT na'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new NominalAttribute(record.get('na'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get a specific numeric attribute by analysis
function getNumericAttribute(name, analyseId) {
  var session = driver.session();
  query = 'Match (na:NumericAttribute),(nf:AnalysisNumericFeatures),(f:AnalysisFeatures),(a:Analysis),(ta:AnalysisTarget) WHERE a.uuid = "' + analyseId + '" AND na.name= "' + name + '"  AND ((a)-[:hasFeaturesAnalysis]->(f)-[:hasNumericFeaturesAnalysis]->(nf)-[:hasFeatures]->(na) OR (a)-[:hasTargetAnalysis]->(ta)-[:hasTarget]->(na)) RETURN DISTINCT na'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new NumericAttribute(record.get('na'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get numeric attributes by dataset
function getNumericAttributebyDataset(datasetId) {
  var session = driver.session();
  query = 'MATCH (dl)-[]-(e:EntityClass)-[]-(a:NumericAttribute) WHERE dl.uuid = "' + datasetId + '" AND (dl:DLStructuredDataset OR dl:DLSemistructuredDataset OR dl:DLUnstructuredDataset) RETURN DISTINCT a'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new NumericAttribute(record.get('a'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get nominal attributes by dataset
function getNominalAttributebyDataset(datasetId) {
  var session = driver.session();
  query = 'MATCH (dl)-[]-(e:EntityClass)-[]-(a:NominalAttribute) WHERE dl.uuid = "' + datasetId + '" AND (dl:DLStructuredDataset OR dl:DLSemistructuredDataset OR dl:DLUnstructuredDataset) RETURN DISTINCT a'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new NominalAttribute(record.get('a'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get quality informations by dataset to create filter (there are no quality in databse for now)
function getQuality(dataSet) {
  var session = driver.session();
  var query = "MATCH (q:quality),(n) WHERE (q)<-[:hasQuality]-(n) AND n.name CONTAINS (" + dataSet.name + ") RETURN DISTINCT q";
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new Quality(record.get('q'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}


//Function to get quaity value with dataset Id and quality name
function getQualityValue(quality, dataSet) {
  var session = driver.session();
  query = "MATCH (q:Quality)<-[r:hasQuality]-(n) WHERE q.name CONTAINS (" + quality.name + ") AND n.name CONTAINS (" + dataSet.name + ") RETURN DISTINCT r";
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new QualityValue(record.get('r'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get all the operation to create filter
function getOperations() {
  var session = driver.session();
  query = "MATCH (o:Operation) RETURN DISTINCT o";
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new Operation(record.get('o'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get landmarkes by study to create a filter
function getLandmarkers(study) {
  var session = driver.session();
  query = "MATCH (l:Landmarker),(s:Study) WHERE (l)<-[:hasImplementation]-()<-[:hasAnalysis]-(s) AND (toLower(s.name) CONTAINS toLower('" + study.name + "')) RETURN DISTINCT l";
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new Landmarker(record.get('l'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get parameter by study to create a filter
function getParameter(study) {
  var session = driver.session();
  query = 'MATCH (s:Study)-[:hasAnalysis]->()-[:hasImplementation]->()-[:hasParameter]->(p:Parameter) WHERE toLower(s.name) CONTAINS toLower("' + study.name + '") RETURN DISTINCT p'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new Parameter(record.get('p'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get parameter settings
function getParameterSettings() {
  var session = driver.session();
  query += 'MATCH (p:ParameterSettings) RETURN DISTINCT p'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new ParameterSettings(record.get('p'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get evaluation by study to create a filter
function getEvaluation(study) {
  var session = driver.session();
  query = 'MATCH (s:Study)-[:hasAnalysis]->()<-[:evaluateAnalysis]-()-[:useEvaluationMeasure]-(e:EvaluationMeasure) WHERE (toLower(s.name) CONTAINS toLower("' + study.name + '")) RETURN DISTINCT e'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new Evaluation(record.get('e'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get entity class by analysis
function getEntityClassByAnalyse(analyseName, analyseId) {
  var session = driver.session();
  query = 'MATCH (e:EntityClass)-[]-(n)<-[:analyze]-(a:Analysis) WHERE a.name = "' + analyseName + '" AND a.uuid = "' + analyseId + '" AND (n:DLStructuredDataset OR n:DLSemistructuredDataset OR n:DLUnstructuredDataset) RETURN DISTINCT e';
  console.log(query)
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new EntityClass(record.get('e'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}


//function to get entity class by dataset
function getEntityClassByDataset(datasetName, datasetId, typeDS) {
  var session = driver.session();
  query = 'MATCH (e:EntityClass)<-[:hasEntityClass]-(a) WHERE '
  if (typeDS.includes("Semi-Structured")) {
    query = query + "a:DLSemistructuredDataset";
  } else {
    if (typeDS.includes("Unstructured")) {
      query = query + "a:DLUnstructuredDataset ";
    } else {
      if (typeDS.includes("Structured")) {
        query = query + "a:DLStructuredDataset ";
      }
    }
  }
  query += ' AND a.name = "' + datasetName + '" AND a.uuid = "' + datasetId + '" RETURN DISTINCT e';
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new EntityClass(record.get('e'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//function to search for dataset relationship with other datasets 
function getRelationshipDSbyDataset(dsName, dsId, type, relationName = '') {
  var session = driver.session();
  //Cypher request to get relationships and datasets that have relation with the target
  query = `MATCH (dl:DLSemistructuredDataset)<-[]-()-[]->(rDS:RelationshipDS),(autreDS),(adrR:AnalysisDSRelationship)
    WHERE dl.name CONTAINS '` + dsName + `' and dl.uuid = '` + dsId + `'
    AND
    (autreDS:DLStructuredDataset OR autreDS:DLSemistructuredDataset OR autreDS:DLUnstructuredDataset)
    AND
    (autreDS)<-[]-(adrR:AnalysisDSRelationship)-[]->(rDS:RelationshipDS)`
  if (relationName != '') {
    query += ' AND rDS.name = "' + relationName + '"'
  }
  query += ` RETURN DISTINCT`
  switch (type) {
    //Case to get relations
    case 'RelationshipDS':
      query += ' rDS'
      return session
        .run(
          query)
        .then(result => {
          return result.records.map(record => {
            return new RelationshipDS(record.get('rDS'))
          });
        })
        .catch(error => {
          throw error;
        })
        .finally(() => {
          return session.close();
        });
    //Case to get datasets with a specific relation
    case 'Dataset':
      query += ' autreDS'
      return session
        .run(
          query)
        .then(result => {
          return result.records.map(record => {
            return new DLStructuredDataset(record.get('autreDS'))
          });
        })
        .catch(error => {
          throw error;
        })
        .finally(() => {
          return session.close();
        });
  }
}

//Function to get relationship value between two datasets
function getRelationshipDSAnalysisbyDataset(dataset1, dataset2, Relationship) {
  var session = driver.session();
  query = `MATCH (ds1)-[]-(adsr:AnalysisDSRelationship)-[]-(ds2), (adsr)-[]-(rds:RelationshipDS) 
              WHERE rds.name = "` + Relationship + `" AND ds1.uuid = "` + dataset1 + `" AND ds2.uuid = "` + dataset2 + `" 
                AND (ds1:DLStructuredDataset OR ds1:DLSemistructuredDataset OR ds1:DLUnstructuredDataset) 
                AND (ds2:DLStructuredDataset OR ds2:DLSemistructuredDataset OR ds2:DLUnstructuredDataset)
                RETURN DISTINCT adsr`
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new AnalysisDSRelationship(record.get('adsr'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to search for relationships between attribute by datasets or analysis. allow to get relationship name,value and others attributes linked to the target.
function getRelationshipAttribute(sourceId, name = '', type, relationName = '', name2 = '') {
  var session = driver.session();
  query = `MATCH (dl)-[]-(e:EntityClass)-[]-(a),(a)-[r1:hasAttribute]-(AA:AnalysisAttribute)-[r2:useMeasure]-(RA:RelationshipAtt),(AA)-[r3:hasAttribute]-(a2)
  WHERE dl.uuid = '`+ sourceId + `'
  AND
  (a:NominalAttribute OR a:NumericAttribute OR a:Attribute)`
  if (relationName != '') {
    query += ' AND RA.name ="' + relationName + '"'
  }
  switch (type) {
    case 'relation':
      query += ` RETURN DISTINCT RA union all MATCH (dl)-[]-()-[]-(e:EntityClass)-[]-(a),(a)-[r1:hasAttribute]-(AA:AnalysisAttribute)-[r2:useMeasure]-(RA:RelationshipAtt),(AA)-[r3:hasAttribute]-(a2)
      WHERE dl.uuid = '`+ sourceId + `'
      AND
      (a:NominalAttribute OR a:NumericAttribute OR a:Attribute)`
      if (relationName != '') {
        query += ' AND RA.name ="' + relationName + '"'
      }

      query += `RETURN DISTINCT RA`
      return session
        .run(
          query)
        .then(result => {
          return result.records.map(record => {
            return new RelationshipAtt(record.get('RA'))
          });
        })
        .catch(error => {
          throw error;
        })
        .finally(() => {
          return session.close();
        });
    case 'analyse':
      query += ` RETURN DISTINCT a union all MATCH (dl)-[]-()-[]-(e:EntityClass)-[]-(a),(a)-[r1:hasAttribute]-(AA:AnalysisAttribute)-[r2:useMeasure]-(RA:RelationshipAtt),(AA)-[r3:hasAttribute]-(a2)
      WHERE dl.uuid = '`+ sourceId + `'
      AND
      (a:NominalAttribute OR a:NumericAttribute OR a:Attribute)`
      if (relationName != '') {
        query += ' AND RA.name ="' + relationName + '"'
      }
      query += `RETURN DISTINCT a`
      return session
        .run(
          query)
        .then(result => {
          return result.records.map(record => {
            return new Attribute(record.get('a'))
          });
        })
        .catch(error => {
          throw error;
        })
        .finally(() => {
          return session.close();
        });
    case 'relationValue':
      query += ` AND toLower(a2.name) CONTAINS toLower('` + name2 + `') AND toLower(a.name) CONTAINS toLower('` + name + `') RETURN DISTINCT AA`
      query += ` union all MATCH (dl)-[]-()-[]-(e:EntityClass)-[]-(a),(a)-[r1:hasAttribute]-(AA:AnalysisAttribute)-[r2:useMeasure]-(RA:RelationshipAtt),(AA)-[r3:hasAttribute]-(a2)
      WHERE dl.uuid = '`+ sourceId + `'
      AND
      (a:NominalAttribute OR a:NumericAttribute OR a:Attribute)`
      if (relationName != '') {
        query += ' AND RA.name ="' + relationName + '"'
      }
      query += ` AND toLower(a2.name) CONTAINS toLower('` + name2 + `') AND toLower(a.name) CONTAINS toLower('` + name + `') RETURN DISTINCT AA`
      // console.log(query)
      return session
        .run(
          query)
        .then(result => {
          return result.records.map(record => {
            return new AnalysisAttribute(record.get('AA'))
          });
        })
        .catch(error => {
          throw error;
        })
        .finally(() => {
          return session.close();
        });

  }

}

//fonction de recherches des datasets avec les diff??rents param??tres pour chaque filtre.
//Function to search dataset metadata, with parameters for each filter.
function getDatabases(tags, type = 'defaultValue', creationdate = '0001-01-01T00:00:00Z', quality = [], sensitivity = 0, entityAttributeNames = "") {
  var session = driver.session();
  //Cypher query with ifs to have the dataset type filter used.
  var query = "MATCH (ds),(a),(e:EntityClass) WHERE ("; //,(q:QualityMetric),(s:SensitivityMark), (sv:SensitivityValue)
  if (!type.includes("Structured") && !type.includes("Semi-Structured") && !type.includes("Unstructured")) {
    query += " ds:DLStructuredDataset OR ds:DLSemistructuredDataset OR ds:DLUnstructuredDataset ";
  } else {
    if (type.includes("Structured") && type.includes("Semi-Structured") && type.includes("Unstructured")) {
      query += " ds:DLStructuredDataset OR ds:DLSemistructuredDataset OR ds:DLUnstructuredDataset ";
    } else {
      if (type.includes("Structured") && type.includes("Semi-Structured")) {
        query += " ds:DLStructuredDataset OR ds:DLSemistructuredDataset ";
      } else {
        if (type.includes("Structured") && type.includes("Unstructured")) {
          query += " ds:DLStructuredDataset OR ds:DLUnstructuredDataset ";
        } else {
          if (type.includes("Semi-Structured") && type.includes("Unstructured")) {
            query += " ds:DLSemistructuredDataset OR ds:DLUnstructuredDataset ";
          } else {
            if (type.includes("Semi-Structured")) {
              query = query + "ds:DLSemistructuredDataset";
            } else {
              if (type.includes("Unstructured")) {
                query = query + "ds:DLUnstructuredDataset ";
              } else {
                if (type.includes("Structured")) {
                  query = query + "ds:DLStructuredDataset";
                }
              }
            }
          }
        }
      }
    }
  }
  query = query + ") AND (";
  for (var i = 0; i < tags.length; i++) {
    if (i != tags.length - 1) {
      query = query + "toLower(ds.name) CONTAINS toLower('" + tags[i] + "') OR toLower(ds.description) CONTAINS toLower('" + tags[i] + "') OR "
    }
    else {
      query = query + "toLower(ds.name) CONTAINS toLower('" + tags[i] + "') OR toLower(ds.description) CONTAINS toLower('" + tags[i] + "')"
    }
  }
  //Cypher query for dates filter
  query = query + ' ) AND (datetime(ds.creationDate) >= datetime("' + creationdate + '"))'

  //Cypher query for the quality filter
  // if(quality.lenght>0){
  //   query += "AND (n)-[qv:qualityValue]-(q) AND ("
  //   for( var i=0; i<quality.length; i++){
  //     if(i!=quality.length -1){
  //       query += "toLower(q.name) CONTAINS toLower("+ quality[i][0] +") AND qv.value >= "+ quality[i][1] +" OR" ;
  //     }else{
  //       query += "toLower(q.name) CONTAINS toLower("+ quality[i][0] +") AND qv.value >= "+ quality[i][1] +" )  "
  //     }
  //   }
  // }

  //Cyper query for the sensitivity filter
  // if(sensitivity != 0){
  //   query += "(n)-[:hasSensitivity]-(s)-[:hasValue]-(sv) AND (sv.value >= "+ sensitivity +" )";
  // }

  //Cypher query for the entity class filter
  if (entityAttributeNames.length > 0) {
    query += "AND (a:NominalAttribute OR a:NumericAttribute) AND ((ds)-[:hasEntityClass]->(e:EntityClass)-[:hasAttribute]->(a)) AND ( toLower(e.name) CONTAINS toLower('" + entityAttributeNames + "') OR toLower(a.name) CONTAINS toLower('" + entityAttributeNames + "'))"
  }

  //Cypher query that allow a dataset to not have a Tag, else it is not taken in account
  query = query + ' OPTIONAL MATCH (ds)-[:hasTag]->(t:Tag) WHERE ( '
  for (var i = 0; i < tags.length; i++) {
    if (i != tags.length - 1) {
      query = query + "toLower(t.name) CONTAINS toLower('" + tags[i] + "') OR "
    }
    else {
      query = query + "toLower(t.name) CONTAINS toLower('" + tags[i] + "')"
    }
  }

  query = query + ") RETURN distinct ds"
  console.log('dataset ' + query)
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new DLStructuredDataset(record.get('ds'));
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

function graphList() {
  var session = driver.session();
  query = 'CALL gds.graph.list() YIELD graphName'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return record.get('graphName');
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

function createGraph() {
  var session = driver.session();
  query = `CALL gds.graph.create.cypher(
    'graph-DDDT',
    'MATCH (n) WHERE (n:DLStructuredDataset OR n:DLSemistructuredDataset OR n:DLUnstructuredDataset OR n:Tag) RETURN id(n) AS id',
    'MATCH (n)-[]->(m) WHERE (n:DLStructuredDataset OR n:DLSemistructuredDataset OR n:DLUnstructuredDataset OR n:Tag) AND (m:DLStructuredDataset OR m:DLSemistructuredDataset OR m:DLUnstructuredDataset OR m:Tag) RETURN id(n) AS source, id(m) AS target'
    )`
  return session
    .run(
      query)
    .then()
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

function createGraphAll() {
  var session = driver.session();
  query = `CALL gds.graph.create.cypher(
    'graph-All',
    'MATCH (n) RETURN id(n) AS id',
    'MATCH (n)-[]->(m) RETURN id(n) AS source, id(m) AS target'
    )`
  return session
    .run(
      query)
    .then()
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

function algoSimilairty() {
  var session = driver.session();
  query = `CALL gds.nodeSimilarity.stream('graph-DDDT')
  YIELD node1, node2, similarity
  RETURN gds.util.asNode(node1).name AS Person1, gds.util.asNode(node2).name AS Person2, similarity
  ORDER BY similarity DESCENDING, Person1, Person2`
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return [record.get('Person1'), record.get('Person2'), record.get('similarity')];
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

function algoBetweennessCentrality() {
  var session = driver.session();
  query = `CALL gds.betweenness.stream('graph-All')
  YIELD nodeId, score
  WHERE (labels(gds.util.asNode(nodeId))=["DLStructuredDataset"] OR labels(gds.util.asNode(nodeId))=["DLUnstructuredDataset"] OR labels(gds.util.asNode(nodeId))=["DLSemistructuredDataset"])
  RETURN gds.util.asNode(nodeId).name AS name, score, labels(gds.util.asNode(nodeId)) AS label
  ORDER BY score DESC`
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return [record.get('name'), record.get('score'), record.get('label')];
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

function getGraph(query) {
  var session = driver.session();
  var nodes = []
  var edges = []
  var count = 0
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        var data = record._fields
        for (var i = 0; i < data.length; i++) {
          if (record._fields[i] != null) {
            if (record._fields[i].labels) {
              nodes.push({ id: record._fields[i].identity.low, group: record._fields[i].labels[0], properties: record._fields[i].properties, title: JSON.stringify(record._fields[i].properties).replaceAll('","', '",\n"'), label: record._fields[i].properties.value || record._fields[i].labels[0] + " \n " + (record._fields[i].properties.name || record._fields[i].properties.operationType || record._fields[i].properties.description || record._fields[i].properties.descriptionAnalysis || record._fields[i].properties.ingestionMode) })
            }
            if (record._fields[i].type) {
              edges.push({ from: record._fields[i].start.low, to: record._fields[i].end.low, label: record._fields[i].type, properties: record._fields[i].properties, title: JSON.stringify(record._fields[i].properties).replaceAll('","', '",\n"'), id: record._fields[i].identity.low })
            }
            if (record._fields[i].segments) {
              for (var j = 0; j < record._fields[i].segments.length; j++) {
                nodes.push({ id: record._fields[i].segments[j].end.identity.low, group: record._fields[i].segments[j].end.labels[0], properties: record._fields[i].segments[j].end.properties, title: JSON.stringify(record._fields[i].segments[j].end.properties).replaceAll('","', '",\n"'), label: record._fields[i].segments[j].end.properties.value || (record._fields[i].segments[j].end.labels[0] + "\n" + record._fields[i].segments[j].end.properties.name || record._fields[i].segments[j].end.properties.description || record._fields[i].segments[j].end.properties.descriptionAnalysis || record._fields[i].segments[j].end.properties.operationType || record._fields[i].segments[j].end.properties.operationType) })
                nodes.push({ id: record._fields[i].segments[j].start.identity.low, group: record._fields[i].segments[j].start.labels[0], properties: record._fields[i].segments[j].start.properties, title: JSON.stringify(record._fields[i].segments[j].start.properties).replaceAll('","', '",\n"'), label: record._fields[i].segments[j].start.properties.value || (record._fields[i].segments[j].start.labels[0] + "\n" + record._fields[i].segments[j].start.properties.name || record._fields[i].segments[j].start.properties.description || record._fields[i].segments[j].start.properties.descriptionAnalysis || record._fields[i].segments[j].start.properties.operationType || record._fields[i].segments[j].start.properties.ingestionMode) })
                edges.push({ from: record._fields[i].segments[j].relationship.start, to: record._fields[i].segments[j].relationship.end, label: record._fields[i].segments[j].relationship.type, id: record._fields[i].segments[j].relationship.identity.low, properties: record._fields[i].segments[j].relationship.properties, title: JSON.stringify(record._fields[i].segments[j].relationship.properties).replaceAll('","', '"\n"') })
              }
            }

          }
        }

        var uniqueNodes = Array.from(new Set(nodes.map(a => a.id)))
          .map(id => {
            return nodes.find(a => a.id === id)
          })
        var uniqueEdges = Array.from(new Set(edges.map(a => a.id)))
          .map(id => {
            return edges.find(a => a.id === id)
          })
        return [uniqueNodes, uniqueEdges];
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//------------------------------------------ADD-----------------------------

//-------------------------------------ADD start----------------------------
//Function to search for analysis metadata by study id or analysis
function getTags(tag) {
  //console.log(tag);
  var session = driver.session();
  //partie cypher de base pour r??cup??rer les analyses
  //Classic cypher request to get analysis
  var query = "match (t:Tag) where t.name =~'" + tag + ".*' return t"

  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new Tag(record.get('t'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}




// //Exports of used functions
module.exports.getTags = getTags;
module.exports.getProcesses = getProcesses;
module.exports.getStudies = getStudies;
module.exports.getAnalyses = getAnalyses;
module.exports.getDatabases = getDatabases;
module.exports.getQuality = getQuality;
module.exports.getQualityValue = getQualityValue;
module.exports.getOperations = getOperations;
module.exports.getLandmarkers = getLandmarkers;
module.exports.getParameter = getParameter;
module.exports.getParameterSettings = getParameterSettings;
module.exports.getEvaluation = getEvaluation;
module.exports.getNominalFeaturesbyAnalysis = getNominalFeaturesbyAnalysis;
module.exports.getNumericFeaturesbyAnalysis = getNumericFeaturesbyAnalysis;
module.exports.getNumericAttributebyAnalysis = getNumericAttributebyAnalysis;
module.exports.getNominalAttributebyAnalysis = getNominalAttributebyAnalysis;
module.exports.getNominalAttribute = getNominalAttribute;
module.exports.getNumericAttribute = getNumericAttribute;
module.exports.getEntityClassByAnalyse = getEntityClassByAnalyse;
module.exports.getEntityClassByDataset = getEntityClassByDataset;
module.exports.getRelationshipDSbyDataset = getRelationshipDSbyDataset;
module.exports.getRelationshipDSAnalysisbyDataset = getRelationshipDSAnalysisbyDataset;
module.exports.getNumericAttributebyDataset = getNumericAttributebyDataset;
module.exports.getNominalAttributebyDataset = getNominalAttributebyDataset;
module.exports.getRelationshipAttribute = getRelationshipAttribute;
module.exports.createGraph = createGraph;
module.exports.createGraphAll = createGraphAll;
module.exports.algoSimilairty = algoSimilairty;
module.exports.graphList = graphList;
module.exports.algoBetweennessCentrality = algoBetweennessCentrality;
module.exports.getGraph = getGraph;
