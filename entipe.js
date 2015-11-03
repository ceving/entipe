"use strict";

const CLEAN = 0;
const DIRTY = 1;

var Schema = function (url, schema)
{
  let this_schema = this;

  let query = function (query, success, error) {
    return jQuery.ajax({
      'type': 'POST',
      'url': url,
      encoding: 'UTF-8',
      'contentType': 'application/sql; charset=UTF-8',
      'data': query,
      'dataType': 'json',
      'success': success,
      'error': error});
  };

  let select = function (entity, condition, success, error) {
    if (schema[entity]) {
      let q = "select * from " + quote_identifier(entity);
      if (condition)  q += condition;
      console.debug (q);
      query (q, success, error);
    } else {
      throw new Error ("Unknown entity " + entity);
    }
  };

  let quote_string = function (string) {
    string = String(string);
    return "'" + string.replace(/'/g, "''") + "'";
  };

  let verify_identifier = function (identifier) {
    identifier = String(identifier);
    if (identifier.match(/"$/) || identifier === '__proto__') {
      throw new Error("Unsupported identifier", identifier);
    }
    return identifier;
  };

  let quote_identifier = function (identifier) {
    return '"' + identifier + '"';
  };

  this.insert = {};
  this.select = {};

  for (let entity in schema)
  {
    verify_identifier(entity);

    let attributes = schema[entity].map(verify_identifier);

    this.select[entity] = function (condition, success, error) {
      select (entity, condition, success, error);
    };

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
            i.push(quote_identifier(a));
            v.push(quote_string(values[a]));
          }
        }
        let q
            = "insert into " + quote_identifier(entity)
            + " (" + i.join() + ")"
            + " values (" + v.join() + ")";
        console.debug ("Insert: ", q);
        query (
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
                  = "update " + quote_identifier(entity)
                  + " set " + quote_identifier(attribute)
                  + " = " + quote_string(value)
                  + " where id = " + this_entity.id;
              console.debug ("Update: ", q);
              let r = query (q, function (data) {}, undo);
              console.debug ("Result: ", r);
            }
            else
              insert(undo);
            return;
          }});
      }

      insert ();
    };

    this.insert[entity] = Entity;
  }
};
