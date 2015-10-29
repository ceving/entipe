"use strict";

var Schema = function (url, schema)
{
  var entity;
  var Entity;

  Object.defineProperty (this, "url", {value: url});

  for (entity in schema)
  {
    Entity = function (values)
    {
      var id;
      var attribute;

      Object.defineProperty (this, "id", {
        get: function () { return id; },
        set: function (value) { return id = value; }});

      for (attribute of schema[entity]) {
        (function(that, attribute) {
          Object.defineProperty (that, attribute, {
            enumerable: true,
            get: function () { return values[attribute]; },
            set: function (value) { return values[attribute] = value; }});
        })(this, attribute);
      }
    };
    Object.defineProperty (Entity.prototype, "select", {
      value: function (condition) {
        console.log (this);
      }});

    Object.defineProperty (this, entity, {
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
