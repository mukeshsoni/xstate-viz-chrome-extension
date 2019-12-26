function styleMap(styles) {
  return styles
    ? Object.entries(styles)
        .map(([k, v]) => `${k}: ${v}`)
        .join(";")
    : "";
}

// children always needs to be an array
function addChildrenToElement(el, children) {
  if (children && children.length > 0) {
    children.forEach(child => {
      if (typeof child === "string") {
        el.appendChild(document.createTextNode(child));
      } else {
        el.appendChild(child);
      }
    });
  }
}

export function Element(elName, attributes, children) {
  const el = document.createElement(elName);

  Object.keys(attributes).forEach(attr => {
    el[attr] = attributes[attr];
  });

  // style attributes needs to be merged with
  // default button styles
  el.style = styleMap(attributes.style);

  addChildrenToElement(el, children);

  return el;
}

export function div(attributes, children) {
  return Element("div", attributes, children);
}

export function Button(attributes, children) {
  const buttonStyle = {
    width: "100%",
    "text-align": "center",
    color: "white",
    "text-transform": "uppercase",
    "font-weight": "bold",
    background: "#656565",
    border: "none",
    cursor: "pointer",
    padding: "5px 10px",
    "border-radius": "2px",
    "letter-spacing": "1px",
    ...attributes.style
  };

  return Element("button", { ...attributes, style: buttonStyle }, children);
}

export function Input(props, children) {
  return Element("input", props, children);
}
