"use strict";

var o = {
  a: 7,
  get b() {
    return this.a + 1;
  },
  set c(x) {
    this.a = x / 2
  }
};


var peter;
var home;

function new_peter()
{
  peter = new demo.Person({firstname: "Peter", lastname: "Pan"});
  home = new demo.Address({street: "Second to the right",
                           locality: "Straight on till morning",
                           country: "Neverland"});
}



var x;


var fk1 = document.getElementById('fk1');

function svgnsuri ()
{
  return document.getElementsByTagName('svg')[0].namespaceURI;
}


function entity (name, left, top, attributes)
{
  // It might be necessary to add the schema name to the value of the
  // id attribute of the entity to ensure uniqueness, if more than one
  // schema is displayed in one page.

  return E ('div', {'class': 'entity',
                    'style': 'left:' + left + ';top:' + top},
            E ('table', {'id': '.entity ' + name,
                         'class': 'entity'},
               E ('caption', null,
                  T (name)),
               Ea ('tbody', null,
                   attributes.map (
                     function (attr) {
                       return E ('tr', null,
                                 E ('th', null,
                                    T (attr)),
                                 E ('td', {'class': 'type'},
                                    T ('type')))}))));
}

function add_entity ()
{
  document.querySelector('div.schema').appendChild(
    entity('X', '10em', '20em', ['A', 'B']));

  dragable ('div.schema', 'div.entity', 'table caption');
}


var Schema1;

(function () {
  Schema1 = function (url, schema_definition)
  {
    let schema = this;
    schema.entity = new Map();

    for (let entity_name in schema_definition)
    {
      let entity_definition = schema_definition[entity_name];

      schema.entity.set(entity_name, function ()
      {
        let entity = this;

        for (let attribute_name in entity_definition)
        {
          let attribute_definition = entity_definition[attribute_name];

          entity[attribute_name] = function ()
          {
            let attribute = this;

            switch (attribute_definition.type) {
            case 'integer':
            case 'float':
              attribute.value = Number;
              break;
            case 'text':
              attribute.value = String;
              break;
            case 'reference':
              attribute.value = function (initial_value)
              {
                let value = this;

                value.value = initial_value;
              }
              break;
            default:
              throw "Unsupported value type: " + attribute_definition.type;
            }
//            let attribute_type = attribute_definition.type;
//            if (attribute_type === 'reference')
//              attribute_type += attribute_definition.cardinality
//              + ' => ' + attribute_definition.referee;
//            console.log (entity_name, ':',  attribute_name, ':', attribute_type);
          };
        }
      });
    }
  }
})();

function schema1 ()
{
  return new Schema1 (schema_url, schema_json);
}

function query (sql, cont)
{
  var r = new XMLHttpRequest();
  r.open('POST', schema_url, true);
  r.responseType = 'json';
  r.setRequestHeader("Content-Type", "application/sql;charset=utf-8");
  r.onload = function (e) {
    if (this.status == 200) {
      cont (this.response.data);
    }
  };
  r.send (sql);
}
