# Stick Nodes Asset Manipulation Library

[![Crates.io](https://img.shields.io/crates/v/sticknodes-rs.svg)](https://crates.io/crates/sticknodes-rs)
[![Docs.rs](https://docs.rs/sticknodes-rs/badge.svg)](https://docs.rs/sticknodes-rs)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Guide](https://img.shields.io/badge/Guide-388434?logo=mdBook&logoColor=fff)](https://vincetheprogrammer.github.io/sticknodes-rs/)

A Rust library for reading, creating, and manipulating **Stick Nodes** assets.

Currently supports **`.nodes` (stickfigure)** files, with planned support for **`.stknds` (projects)** and **`.nodemc` (movieclips)** in the future.

> **Version:** 4.0.0-alpha
> **Supported Stick Nodes Version:** Up to 4.2.3 build 72  
> **Note:** This is my first serious Rust library—feedback is welcome!

---

## Features

- 📄 Read and write `.nodes` (stickfigure) files.
- 🛠️ Create and modify stickfigures programmatically.
- 🔜 Future support for `.stknds` (project) and `.nodemc` (movieclip) files.
- 🧩 Node management: add, remove, update nodes easily.
- 🧵 Polyfill support.
- 🧹 Automatic handling of node draw indices when modifying stickfigures.
- 🧠 Safe internal handling using `RefCell` and `Rc` for node references.

---

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
sticknodes-rs = "4.0.0-alpha"
```

## Example Usage
### Creating and Modifying a Stickfigure

```rs
use sticknodes_rs::{Stickfigure, Node, NodeOptions, DrawOrderIndex, Polyfill, PolyfillOptions, IWillNotAbuseUnlimitedNodes, LibraryError};
use std::rc::Rc;
use std::cell::RefCell;

fn stickfigure_examples() -> Result<(), LibraryError> {
    // Create a new Stickfigure with a single root node
    let mut stickfigure = Stickfigure::new();

    // Add a node as a child of the root node
    let node_a_index = stickfigure.add_node(
        Node::from_options(NodeOptions::default()), 
        DrawOrderIndex(0)
    )?;

    // Add a custom node as a child of the previous node
    let node_b_index = stickfigure.add_node(
        Node::from_options(NodeOptions {
            length: 100.0,
            local_angle: 90.0,
            ..Default::default()
        }), 
        node_a_index
    )?;

    // Remove a node (note: draw indices are compacted after removal)
    stickfigure.remove_node(node_a_index)?;

    // Access and modify a node
    if let Some(node) = stickfigure.get_node(DrawOrderIndex(1)) {
        node.borrow_mut().is_static = true;
    }

    // Working with children and search
    let _children = stickfigure.get_children(DrawOrderIndex(0));
    let _long_nodes = stickfigure.get_nodes_with_property(|node| node.borrow().length > 100.0);

    // Adding a polyfill
    let polyfill_index = stickfigure.add_polyfill(
        Polyfill::from_options(PolyfillOptions {
            anchor_node_draw_index: DrawOrderIndex(1),
            ..Default::default()
        }, stickfigure.clone())?
    );

    // Modifying a polyfill
    if let Some(polyfill) = stickfigure.get_polyfill(polyfill_index) {
        polyfill.borrow_mut().set_attached_node_draw_indices(vec![DrawOrderIndex(0)], stickfigure.clone())?;
    }

    // Removing a polyfill
    stickfigure.remove_polyfill(polyfill_index)?;

    // Disabling the node limit (use responsibly)
    stickfigure.set_is_node_limit_enabled(false, IWillNotAbuseUnlimitedNodes(true));

    Ok(())
}
```

### Reading and Writing Stickfigure Files
```rs
use sticknodes_rs::{Stickfigure, LibraryError};
use std::fs::File;
use std::io::{Read, Write};

fn read_write_stickfigure_examples() -> Result<(), LibraryError> {
    // Read a stickfigure from file
    let mut file = File::open("stickfigure_to_read.nodes")
        .map_err(|err| LibraryError::AnyString(format!("Error: {err}")))?;
    
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .map_err(|err| LibraryError::AnyString(format!("Error: {err}")))?;
    
    let mut slice = buffer.as_slice();
    let stickfigure = Stickfigure::from_bytes(&mut slice)?;

    // Write the stickfigure to a new file
    let bytes = stickfigure.to_bytes()?;
    let mut output_file = File::create_new("stickfigure_to_write.nodes")
        .map_err(|err| LibraryError::AnyString(format!("Error: {err}")))?;
    output_file.write_all(&bytes)
        .map_err(|err| LibraryError::AnyString(format!("Error: {err}")))?;

    Ok(())
}
```

## Planned Features
- ✅ Support .nodes stickfigure files (Done)
- 🔜 Read/write .stknds project files
- 🔜 Read/write .nodemc movieclip files
- 🧹 Further API ergonomics improvements
- 📄 More documentation and examples

## Feedback
Since this is my first major Rust project, feedback and suggestions are very much appreciated!
Feel free to open issues, pull requests, or just share thoughts if you have any ideas to improve the library.

## License
This project is licensed under the MIT License.
