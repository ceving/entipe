"use strict";

const CLEAN = 0;
const DIRTY = 1;

var Schema = function (url, schema)
{
  let this_schema = this;

  Object.defineProperty (this_schema, "url", {value: url});

  for (let entity in schema)
  {
    let attributes = schema[entity];

    let Entity = function (values)
    {
      let this_entity = this;
      let id;
      let state = {};

      let insert = function (undo)
      {
        let d = []; // dirty attributes
        let i = []; // identfier names of dirty attributes
        let v = []; // values of dirty attributes
        for (let a in this_entity) {
          if (state[a] == DIRTY) {
            d.push (a);
            i.push(this_schema.quote_identifier(a));
            v.push(this_schema.quote_string(values[a]));
          }
        }
        let q
            = "insert into " + this_schema.quote_identifier(entity)
            + " (" + i.join() + ")"
            + " values (" + v.join() + ")";
        console.debug ("Insert: ", q);
        this_schema.query (
          q,
          function(data) {
            id = data[0].id;
            for (let a in d)
              state[a] = CLEAN;
          },
          function() {
            let undo_error;
            try {
              if (undo) undo();
            }
            catch (e) {
              undo_error = e;
              console.error ("undo failed", e);
            }
            finally {
              if (undo_error)
                throw new Error ("Insert and undo failed", undo_error);
              else
                throw new Error ("Insert failed");
            }
          });
      };

      Object.defineProperty (this_entity, "id", {
        get: function () { return id; }});

      for (let attribute of attributes) {
        state[attribute] = DIRTY;
        Object.defineProperty (this_entity, attribute, {
          enumerable: true,
          get: function () {
            return values[attribute];
          },
          set: function (value) {
            let undo;
            {
              let old = values[attribute];
              undo = function() { values[attribute] = old; };
            }
            values[attribute] = value;
            if (id) {
              let q
                  = "update " + this_schema.quote_identifier(entity)
                  + " set " + this_schema.quote_identifier(attribute)
                  + " = " + this_schema.quote_string(value)
                  + " where id = " + this_entity.id;
              console.debug ("Update: ", q);
              let r = this_schema.query (q, function (data) {}, undo);
              console.debug ("Result: ", r);
            }
            else
              insert(undo);
            return;
          }});
      }

      insert ();
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

Object.defineProperty (Schema.prototype, "quote_string", {
  value: function (string) {
    string = String(string);
    return "'" + string.replace(/'/g, "''") + "'";
  }});

Object.defineProperty (Schema.prototype, "quote_identifier", {
  value: function (identifier) {
    identifier = String(identifier);
    if (identifier.match(/"$/)) {
      throw new Error("Unsupported identifier", identifier);
    }
    return '"' + identifier + '"';
  }});
