"use strict";

/* Create DOM elements. */

function E (name, attributes, children_)
{
  let e = document.createElement(arguments[0]);
  for (let name in arguments[1])
    e.setAttribute (name, arguments[1][name]);
  for (let i = 2; i < arguments.length; i++)
    if (arguments[i])
      e.appendChild (arguments[i]);
  return e;
}

function Ea (name, attributes, children)
{
  return E.apply (null, [name, attributes].concat (children));
}

function T (text)
{
  return document.createTextNode (text);
}
