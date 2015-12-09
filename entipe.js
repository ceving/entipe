"use strict";

function is (type, value)
{
  return value["constructor"] === type;
}

const CLEAN = 0;
const DIRTY = 1;

var schema_json;
var schema_url;

/**
 * Schema
 *
 * @class
 *
 * A Schema object is virtually a database handle.  It knows all
 * entities and attributes defined in the associated database and can
 * be used to create a data access object for each entity.
 *
 * @param {string} url The URL of the Entipe server.
 * @param {Object} schema The database schema.
 */
var Schema = function (url, schema)
{
  schema_json = schema;
  schema_url = url;

  // Make the schema object available for all child objects.

  let this_schema = this;

  // Modification journal.

  let journal = [];
  let journal_update_timeout = 3000;

  // Write the journal to the database.

  let flush_journal = function () {
    if (journal.length) {
      let transaction = 'BEGIN;';
      for (let entry of journal) {
        transaction += entry.statement + ';';
      }
      transaction += 'COMMIT;';
      console.log ("flush_journal", transaction);
      journal = [];
    }
    setTimeout (flush_journal, journal_update_timeout);
  };

  // Activate the journal updates.

  //setTimeout (flush_journal, journal_update_timeout);

  // Quote a SQL string.

  let quote_string = function (string) {
    string = String(string);
    return "'" + string.replace(/'/g, "''") + "'";
  };

  // Verify a SQL identifier.  This function makes sure that SQL
  // identifiers, which would cause a colision with JavaScript
  // identifiers, are rejected.

  let verify_identifier = function (identifier) {
    identifier = String(identifier);
    if (identifier.match(/"$/) || identifier === '__proto__') {
      throw new Error("Unsupported identifier", identifier);
    }
    return identifier;
  };

  // Quote a SQL identifier.

  let quote_identifier = function (identifier) {
    return '"' + identifier + '"';
  };

  // Execute an AJAX query to the Entipe server.

  let query = function (query, success, error) {
    jQuery.ajax({
      'type': 'POST',
      url: url,
      'encoding': 'UTF-8',
      'contentType': 'application/sql; charset=UTF-8',
      'data': query,
      'dataType': 'json',
      'success': success,
      'error': error});
    return;
  };

  // Create an entity constructor for each entity.

  for (let entity in schema)
  {
    verify_identifier(entity);

    let attributes = Object.keys(schema[entity]).map(verify_identifier);

    /**
     * Entity
     *
     * @class
     *
     * Creates a data access object for a database entity.  The
     * attributes of the object passed to the constructor must match
     * the attributes defined during the schema definition.
     *
     * @param {Object} values The attribute values.
     */
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

    /**
     * Insert a new entity into the database.
     */
    Entity.insert = function(attributes)
    {
      return new Entity(attributes);
    };

    /**
     * Execute a select query to the Entipe server and select entities
     * of the specified type with the given condition.
     */
    Entity.select = function (condition, success, error) {
      let eql = "select * from " + quote_identifier(entity);
      if (condition) eql += " where " + condition;
      console.debug (eql);
      query (eql,
             success,
             error);
    };

    this[entity] = Entity;
  }
};
