const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const USER_ID = "nidhanayoob_23112004";
const EMAIL_ID = "na3175@srmist.edu.in";
const COLLEGE_ROLL = "RA2311003012016";

function isValid(entry) {
  const trimmed = entry.trim();
  const pattern = /^[A-Z]->[A-Z]$/;
  if (!pattern.test(trimmed)) return false;
  if (trimmed[0] === trimmed[3]) return false; // self-loop
  return true;
}

function buildHierarchies(edges) {
  const childToParent = {};
  const parentToChildren = {};
  const allNodes = new Set();

  for (const edge of edges) {
    const [parent, child] = edge.split('->');
    allNodes.add(parent);
    allNodes.add(child);

    if (!parentToChildren[parent]) parentToChildren[parent] = [];

    // diamond case: first parent wins
    if (childToParent[child] !== undefined) continue;

    childToParent[child] = parent;
    parentToChildren[parent].push(child);
  }

  // find roots: nodes that are never a child
  const roots = [...allNodes].filter(n => childToParent[n] === undefined).sort();

  // find all nodes reachable from each root
  function getSubtreeNodes(root) {
    const visited = new Set();
    const stack = [root];
    while (stack.length) {
      const node = stack.pop();
      if (visited.has(node)) continue;
      visited.add(node);
      for (const child of (parentToChildren[node] || [])) {
        stack.push(child);
      }
    }
    return visited;
  }

  // detect cycle in a group
  function hasCycle(nodes) {
    for (const node of nodes) {
      const visited = new Set();
      let curr = node;
      while (curr !== undefined) {
        if (visited.has(curr)) return true;
        visited.add(curr);
        curr = parentToChildren[curr]?.[0];
      }
    }
    // also check via DFS
    const visitedGlobal = new Set();
    const inStack = new Set();
    function dfs(node) {
      visitedGlobal.add(node);
      inStack.add(node);
      for (const child of (parentToChildren[node] || [])) {
        if (!visitedGlobal.has(child)) {
          if (dfs(child)) return true;
        } else if (inStack.has(child)) {
          return true;
        }
      }
      inStack.delete(node);
      return false;
    }
    for (const node of nodes) {
      if (!visitedGlobal.has(node)) {
        if (dfs(node)) return true;
      }
    }
    return false;
  }

  // build nested tree object
  function buildTree(node) {
    const children = parentToChildren[node] || [];
    const obj = {};
    for (const child of children) {
      obj[child] = buildTree(child);
    }
    return obj;
  }

  // calculate depth
  function calcDepth(node) {
    const children = parentToChildren[node] || [];
    if (children.length === 0) return 1;
    return 1 + Math.max(...children.map(calcDepth));
  }

  const coveredNodes = new Set();
  const hierarchies = [];

  for (const root of roots) {
    const subtree = getSubtreeNodes(root);
    subtree.forEach(n => coveredNodes.add(n));

    if (hasCycle([...subtree])) {
      hierarchies.push({ root, tree: {}, has_cycle: true });
    } else {
      const tree = { [root]: buildTree(root) };
      const depth = calcDepth(root);
      hierarchies.push({ root, tree, depth });
    }
  }

  // handle pure cycles (nodes never covered - no root found)
  const uncovered = [...allNodes].filter(n => !coveredNodes.has(n)).sort();
  if (uncovered.length > 0) {
    const cycleRoot = uncovered[0];
    hierarchies.push({ root: cycleRoot, tree: {}, has_cycle: true });
  }

  return hierarchies;
}

app.post('/bfhl', (req, res) => {
  const { data } = req.body;

  if (!data || !Array.isArray(data)) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const invalid_entries = [];
  const duplicate_edges = [];
  const seen = new Set();
  const validEdges = [];

  for (const entry of data) {
    const trimmed = entry.trim();
    if (!isValid(trimmed)) {
      invalid_entries.push(trimmed || entry);
      continue;
    }
    if (seen.has(trimmed)) {
      if (!duplicate_edges.includes(trimmed)) {
        duplicate_edges.push(trimmed);
      }
      continue;
    }
    seen.add(trimmed);
    validEdges.push(trimmed);
  }

  const hierarchies = buildHierarchies(validEdges);

  const nonCyclic = hierarchies.filter(h => !h.has_cycle);
  const total_trees = nonCyclic.length;
  const total_cycles = hierarchies.filter(h => h.has_cycle).length;

  let largest_tree_root = '';
  let maxDepth = -1;
  for (const h of nonCyclic) {
    if (h.depth > maxDepth || (h.depth === maxDepth && h.root < largest_tree_root)) {
      maxDepth = h.depth;
      largest_tree_root = h.root;
    }
  }

  res.json({
    user_id: USER_ID,
    email_id: EMAIL_ID,
    college_roll_number: COLLEGE_ROLL,
    hierarchies,
    invalid_entries,
    duplicate_edges,
    summary: {
      total_trees,
      total_cycles,
      largest_tree_root
    }
  });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));