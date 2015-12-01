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


function dbval (entity, id, attribute, value)
{
  return $ ('<span>')
    .addClass('dbval')
    .attr ('id', entity + '#' + id + '.' + attribute)
    .attr ('contenteditable', 'true')
    .append (value);
}


var peter;
var home;

function new_peter()
{
  peter = new demo.Person({firstname: "Peter", lastname: "Pan"});
  home = new demo.Address({street: "Second to the right",
                           locality: "Straight on till morning",
                           country: "Neverland"});
}

$ (function () {
  //  demo.query (
  demo.Person.select(
    null,
    function (data) {
      $.each (data, function (key, val) {
        console.log (val.id, val.firstname, val.lastname);
        $ ("#person").find('tbody')
          .append ($ ('<tr>')
                   .append ($ ('<td>').addClass("oplus").append ('&oplus;'))
                   .append ($ ('<td>').append (dbval ('person', val.id, 'firstname', val.firstname)))
                   .append ($ ('<td>').append (dbval ('person', val.id, 'lastname', val.lastname)))
                   .append ($ ('<td>').addClass("ominus").append ('&ominus;'))
                  );
      });
    });

});

function dump() { console.debug(arguments); }

function clip (value, min, max)
{
  return value < min ? min : value > max ? max : value;
}

var x;

function dragable (bounding_box, element_to_move, element_to_select)
{
  let bb = $(bounding_box);
  let em = bb.find(element_to_move);

  bb = bb.get(0);

  em.each (function (index, em) {
    let es = $(em).find(element_to_select).get(0);

    console.debug ('bounding box', bb);
    console.debug ('element to move', em);
    console.debug ('element to select', es);

    if (!bb || !em || !es) return;

    let start;
    let move_within;
    let move_outside;
    let leave;
    let stop_within;
    let stop_outside;

    start = function (event)
    {
      bb.addEventListener ("mousemove", move_within, true);
      bb.addEventListener ("mouseup", stop_within, true);
      bb.addEventListener ("mouseleave", leave, true);
    }

    move_within = function (event)
    {
      let left = clip (em.offsetLeft + event.movementX,
                       0, bb.clientWidth - em.offsetWidth);
      let top  = clip (em.offsetTop  + event.movementY,
                       0, bb.clientHeight - em.offsetHeight);

      em.style.left = left + "px";
      em.style.top  = top + "px";

      fk1.pathSegList[1].x = left;
      fk1.pathSegList[1].x2 = left - 50;
      fk1.pathSegList[1].y = top;
      fk1.pathSegList[1].y2 = top;

      event.preventDefault ();
    }

    move_outside = function (event)
    {
      event.preventDefault ();
    }

    leave = function (event)
    {
      if (event.target === bb) {
        console.debug ("LEAVE", event);

        bb.removeEventListener ("mousemove", move_within, true);
        bb.removeEventListener ("mouseup", stop_within, true);
        bb.removeEventListener ("mouseleave", leave, true);

        document.addEventListener ("mousemove", move_outside, true);
        document.addEventListener ("mouseup", stop_outside, true);
      }
      event.preventDefault ();
    }

    stop_within = function (event)
    {
      bb.removeEventListener ("mousemove", move_within, true);
      bb.removeEventListener ("mouseup", stop_within, true);
      bb.removeEventListener ("mouseleave", leave, true);

      event.preventDefault ();
    }

    stop_outside = function (event)
    {
      document.removeEventListener ("mousemove", move_outside, true);
      document.removeEventListener ("mouseup", stop_outside, true);

      event.preventDefault ();
    }

//    em.style.position = 'absolute';
    es.addEventListener ("mousedown", start, true);
  });
}

dragable ('div.schema', 'div.entity', 'table caption');

var fk1 = document.getElementById('fk1');

function svgnsuri ()
{
  return document.getElementsByTagName('svg')[0].namespaceURI;
}

  
function Entity ()
{
  
}
