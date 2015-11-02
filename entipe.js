"use strict";

var Schema = function (url, schema)
{
  let this_schema = this;

  Object.defineProperty (this_schema, "url", {value: url});

  for (let entity in schema)
  {
    let Entity = function (values)
    {
      let this_entity = this;
      let id;

      Object.defineProperty (this_entity, "id", {
        get: function () { return id; }});

      for (let attribute of schema[entity]) {
        Object.defineProperty (this_entity, attribute, {
          enumerable: true,
          get: function ()
          {
            return values[attribute];
          },
          set: function (value)
          {
            let undo;
            {
              let old = values[attribute];
              undo = function() { values[attribute] = old; };
            }
            values[attribute] = value;
            if (id) {
              let q = "update " + this_schema.quote_identifier(entity)
                  + " set " + this_schema.quote_identifier(attribute)
                  + " = " + this_schema.quote_value(value)
                  + " where id = " + this_entity.id;
              console.debug ("Update: ", q);
              let r = this_schema.query (q, function (data) {}, undo);
              console.debug ("Result: ", r);
            } else {
              let i = [];
              let v = [];
              for (let a in this_entity) {
                i.push(this_schema.quote_identifier(a));
                v.push(this_schema.quote_value(values[a]));
              }
              let q = "insert into " + entity + "(" + i.join() + ") values (" + v.join() + ")";
              console.debug ("Insert: ", q);
              let insert = this_schema.query (
                q,
                function(data) {
                  id = data[0].id;
                },
                undo);
            }
            return;
          }});
      }
    };
    Object.defineProperty (Entity.prototype, "select", {
      value: function (condition) {
      }});

    Object.defineProperty (this_schema, entity, {
      enumerable: true,
      value: Entity});
  }
};

Object.defineProperty (Schema.prototype, "query", {
  value: function (query, success, error) {
    return jQuery.ajax({
      'type': 'POST',
      'url': this.url,
      encoding: 'UTF-8',
      'contentType': 'application/sql; charset=UTF-8',
      'data': query,
      'dataType': 'json',
      'success': success,
      'error': error});
  }});

Object.defineProperty (Schema.prototype, "quote_value", {
  value: function (value) {
    console.warn ("Quoting value not implemented");
    return "'" + value + "'";
  }});

Object.defineProperty (Schema.prototype, "quote_identifier", {
  value: function (identifier) {
    console.warn ("Quoting identifier not implemented");
    return '"' + identifier + '"';
  }});
