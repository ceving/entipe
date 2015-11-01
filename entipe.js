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
        get: function () { return id; },
        set: function (value) { return id = value; }});

      for (let attribute of schema[entity]) {
        Object.defineProperty (this_entity, attribute, {
          enumerable: true,
          get: function () {
            return values[attribute];
          },
          set: function (value) {
            return values[attribute] = value;
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
  value: function (query, success) {
    if (!success)
      success = function () {};
    return jQuery.ajax({
      'type': 'POST',
      'url': this.url,
      encoding: 'UTF-8',
      'contentType': 'application/sql; charset=UTF-8',
      'data': query,
      'dataType': 'json',
      'success': success});
  }});
