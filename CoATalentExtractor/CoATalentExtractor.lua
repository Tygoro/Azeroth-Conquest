local ADDON_NAME = ...

CoATalentExtractorDB = CoATalentExtractorDB or {
  version = 5,
  captures = {},
  export = {},
}

local ROOT_NAMES = {
  "CoATalentFrameTreeViewSpecTree",
  "CoATalentFrameTreeView",
  "CoATalentFrame",
}

local DISCOVERY_ROOT_NAMES = {
  "CoATalentFrameTreeView",
  "CoATalentFrameTreeViewSpecTree",
  "CoATalentFrameTreeViewSpecTreePool",
  "CoATalentFrameTreeViewClassTree",
  "CoATalentFrameTreeViewClassTreePool",
  "CoATalentFrameTreeViewSidebar",
  "CoATalentFrameTreeViewAscension",
  "CoATalentFrame",
}

local DISCOVERY_FIELD_NAMES = {
  "dataProvider",
  "DataProvider",
  "treeData",
  "TreeData",
  "nodeData",
  "nodes",
  "Nodes",
  "edges",
  "connections",
  "lines",
  "pool",
  "Pool",
  "buttonPool",
  "nodePool",
  "framePool",
  "activeObjects",
  "inactiveObjects",
  "objects",
  "frames",
  "scrollBox",
  "ScrollBox",
  "scrollChild",
  "ScrollChild",
  "content",
  "Content",
  "view",
  "View",
  "elementData",
  "ElementData",
  "talentData",
  "specData",
  "classData",
  "sidebarData",
  "ascensionData",
  "milestones",
  "Milestones",
  "entryData",
  "EntryData",
  "buttons",
  "Buttons",
  "nodeButtons",
  "owner",
  "Owner",
  "parent",
  "Parent",
  "provider",
  "Provider",
}

local NODE_TYPE_FIELD_NAMES = {
  "nodeType",
  "type",
  "shape",
  "buttonType",
  "isChoice",
  "choice",
  "isPassive",
  "passive",
  "isActive",
  "active",
  "autoGranted",
  "isAutoGranted",
  "canRefund",
  "refundable",
  "maxRank",
  "rank",
  "pool",
  "pointPool",
  "treeType",
  "treeID",
  "treeId",
  "specID",
  "specId",
  "classID",
  "classId",
}

local CONNECTION_FIELD_NAMES = {
  "source",
  "sourceNode",
  "sourceNodeID",
  "sourceNodeId",
  "from",
  "fromNode",
  "fromNodeID",
  "fromNodeId",
  "target",
  "targetNode",
  "targetNodeID",
  "targetNodeId",
  "to",
  "toNode",
  "toNodeID",
  "toNodeId",
  "parent",
  "child",
  "requirements",
  "prerequisites",
}

-- TODO: Future normalization pipeline — canonical node typing post-processing.
-- Lattice coordinate assignment is now handled by DeriveDeterministicLattice().
-- Remaining: automatic type inference for ambiguous nodes, rank normalization,
-- and per-tree metadata enrichment.

local DISCOVERY_MAX_DEPTH = 2
local DISCOVERY_MAX_OBJECTS = 60
local DISCOVERY_MAX_FIELDS = 24
local DISCOVERY_MAX_CHILDREN_PER_OBJECT = 8
local DISCOVERY_PROGRESS_INTERVAL = 10

local DEBUG = false
local LAST_CAPTURE = nil

-- ── Chat output helpers ─────────────────────────────────────────────────────
local PREFIX   = "|cff88ccff[CoAX]|r "
local C_GOLD   = "|cffFFD700"
local C_GREEN  = "|cff44ff44"
local C_RED    = "|cffff4444"
local C_GRAY   = "|cff999999"
local C_WHITE  = "|cffeeeeee"
local C_END    = "|r"

local function Print(message)
  DEFAULT_CHAT_FRAME:AddMessage(PREFIX .. tostring(message))
end

local function PrintHeader(title)
  DEFAULT_CHAT_FRAME:AddMessage(PREFIX .. C_GOLD .. "── " .. title .. " ──" .. C_END)
end

local function PrintKV(key, value)
  DEFAULT_CHAT_FRAME:AddMessage(PREFIX .. "  " .. C_GRAY .. tostring(key) .. C_END .. "  " .. C_WHITE .. tostring(value) .. C_END)
end

local function PrintSuccess(message)
  DEFAULT_CHAT_FRAME:AddMessage(PREFIX .. C_GREEN .. tostring(message) .. C_END)
end

local function PrintError(message)
  DEFAULT_CHAT_FRAME:AddMessage(PREFIX .. C_RED .. tostring(message) .. C_END)
end

local function PrintSaveHint()
  Print(C_GRAY .. "SavedVariables written on " .. C_WHITE .. "/reload" .. C_GRAY .. " or " .. C_WHITE .. "logout" .. C_END)
  Print(C_GRAY .. "File: WTF/Account/<ACCOUNT>/SavedVariables/CoATalentExtractor.lua" .. C_END)
end

local function Debug(message)
  if DEBUG then
    DEFAULT_CHAT_FRAME:AddMessage(PREFIX .. C_GRAY .. "dbg: " .. tostring(message) .. C_END)
  end
end

local function EnsureDB()
  CoATalentExtractorDB = CoATalentExtractorDB or {}
  CoATalentExtractorDB.version = 5
  CoATalentExtractorDB.captures = CoATalentExtractorDB.captures or {}
  CoATalentExtractorDB.hover = CoATalentExtractorDB.hover or {}
  CoATalentExtractorDB.export = CoATalentExtractorDB.export or {}
  CoATalentExtractorDB.discovery = CoATalentExtractorDB.discovery or {}
  CoATalentExtractorDB.inspect = CoATalentExtractorDB.inspect or {}
  CoATalentExtractorDB.lattice = CoATalentExtractorDB.lattice or {}
end

local function SafeCall(object, methodName)
  if object and object[methodName] then
    local ok, value = pcall(object[methodName], object)
    if ok then return value end
  end
  return nil
end

local function FrameName(frame)
  return frame and frame.GetName and frame:GetName() or nil
end

local function FindRootFrame()
  for _, name in ipairs(ROOT_NAMES) do
    local frame = _G[name]
    if frame and type(frame) == "table" and frame.GetName then
      return frame, name
    end
  end
  return nil, nil
end

local function IsTalentUIOpen()
  local root = _G["CoATalentFrameTreeViewSpecTree"] or _G["CoATalentFrameTreeView"]
  if not root then return false end
  if root.IsVisible then return root:IsVisible() end
  if root.IsShown then return root:IsShown() end
  return true
end

local function TraverseFrame(frame, output, depth, seen)
  if not frame then return end
  if seen[frame] then return end
  if depth > 35 then return end
  seen[frame] = true
  table.insert(output, frame)

  if frame.GetChildren then
    local children = { frame:GetChildren() }
    for _, child in ipairs(children) do
      TraverseFrame(child, output, depth + 1, seen)
    end
  end
end

local function IsTalentNodeFrame(frame)
  local name = FrameName(frame)
  if not name then return false end
  local lower = string.lower(name)
  return (lower:find("coatalentbutton") or lower:find("talentbutton"))
    and not lower:find("icon")
    and not lower:find("rankframe")
    and not lower:find("rank")
    and not lower:find("border")
    and not lower:find("shadow")
end

local function NodeShapeFromObject(object)
  if type(object) ~= "table" then return nil end
  local rawShape = object.shape or object.buttonType or object.nodeShape
  if type(rawShape) == "string" then
    local lower = string.lower(rawShape)
    if lower:find("square") then return "square" end
    if lower:find("circle") or lower:find("round") then return "circle" end
    if lower:find("oct") or lower:find("choice") or lower:find("split") then return "octagon" end
  end
  local name = string.lower(FrameName(object) or "")
  if name:find("square") then return "square" end
  if name:find("circle") or name:find("round") then return "circle" end
  if name:find("oct") or name:find("choice") or name:find("split") then return "octagon" end
  return nil
end

local function NodeTypeFromShape(shape)
  if shape == "square" then return "active" end
  if shape == "circle" then return "passive" end
  if shape == "octagon" then return "choice" end
  return nil
end

local function AscensionFromNode(node)
  if not node then return false end
  if node.autoGranted == true then return true end
  local path = string.lower(node.path or "")
  local name = string.lower(node.name or node.objectName or node.frameName or "")
  return path:find("sidebar") or path:find("ascension") or path:find("milestone")
    or name:find("sidebar") or name:find("ascension") or name:find("milestone")
end

local function NormalizedOwnership(value)
  if value == "sidebarTrack" then return "ascensionTrack" end
  if value == "classTree" or value == "specTree" or value == "ascensionTrack" then return value end
  return nil
end

local function NormalizeDiscoveryBuckets(nodes)
  local buckets = {
    classTree = {},
    specTree = {},
    ascensionTrack = {},
    unknown = {},
  }
  for _, node in ipairs(nodes or {}) do
    local ownership = NormalizedOwnership(node.ownership)
    if AscensionFromNode(node) then ownership = "ascensionTrack" end
    if not ownership then ownership = "unknown" end
    table.insert(buckets[ownership], node)
  end
  return buckets
end

local function IsConnectionFrame(frame)
  local name = FrameName(frame)
  if not name then return false end
  local lower = string.lower(name)
  return name:find("CALineConnectionTemplate")
    or lower:find("connection")
    or lower:find("line")
    or lower:find("edge")
end

local function IsPrimitive(value)
  local valueType = type(value)
  return valueType == "string" or valueType == "number" or valueType == "boolean"
end

local function SafePairs(object)
  if type(object) ~= "table" then return nil end
  local ok, iterator, state, initial = pcall(pairs, object)
  if ok then return iterator, state, initial end
  return nil
end

local function SafeField(object, key)
  if type(object) ~= "table" then return nil end
  local ok, value = pcall(function() return object[key] end)
  if ok then return value end
  return nil
end

local function SafeTableCount(object, limit)
  if type(object) ~= "table" then return nil end
  local count = 0
  local iterator, state, initial = SafePairs(object)
  if not iterator then return nil end
  for _ in iterator, state, initial do
    count = count + 1
    if count >= limit then return count end
  end
  return count
end

local function DiscoveryObjectName(object)
  if type(object) ~= "table" then return nil end
  if object.GetName then
    local ok, name = pcall(object.GetName, object)
    if ok then return name end
  end
  return nil
end

local function SafeObjectType(object)
  if type(object) ~= "table" then return type(object) end
  if object.GetObjectType then
    local ok, objectType = pcall(object.GetObjectType, object)
    if ok then return objectType end
  end
  return "table"
end

local function IncrementCount(counts, key)
  key = tostring(key or "nil")
  counts[key] = (counts[key] or 0) + 1
end

local function InferOwnershipFromPath(path)
  local lower = string.lower(path or "")
  if lower:find("sidebar") or lower:find("ascension") or lower:find("milestone") then return "sidebarTrack" end
  if lower:find("classtree") or lower:find("classdata") or lower:find("class") then return "classTree" end
  if lower:find("spectree") or lower:find("specdata") or lower:find("spec") then return "specTree" end
  return nil
end

local function MetatableSummary(object)
  if type(object) ~= "table" then return nil end
  local ok, metatable = pcall(getmetatable, object)
  if not ok or type(metatable) ~= "table" then return nil end
  local summary = {
    tableCount = SafeTableCount(metatable, 120),
    primitiveFields = {},
    methodFields = {},
  }
  local iterator, state, initial = SafePairs(metatable)
  if iterator then
    local primitiveCount = 0
    local methodCount = 0
    for key, value in iterator, state, initial do
      local keyString = tostring(key)
      if IsPrimitive(value) and primitiveCount < 25 then
        summary.primitiveFields[keyString] = value
        primitiveCount = primitiveCount + 1
      elseif type(value) == "function" and methodCount < 40 then
        table.insert(summary.methodFields, keyString)
        methodCount = methodCount + 1
      elseif key == "__index" and type(value) == "table" then
        summary.indexTableCount = SafeTableCount(value, 120)
      end
    end
  end
  return summary
end

-- TODO: Future graph-edge normalization — connection records should eventually be
-- resolved to canonical (sourceAdvancementId, targetAdvancementId) pairs, enabling
-- the renderer to draw prerequisite edges without positional inference.

local function LooksConnectionLike(object)
  if type(object) ~= "table" then return false end
  local hitCount = 0
  for _, key in ipairs(CONNECTION_FIELD_NAMES) do
    if object[key] ~= nil then hitCount = hitCount + 1 end
  end
  return hitCount >= 2
end

local function ExtractCandidateEdgeRecord(object, path)
  if not LooksConnectionLike(object) then return nil end
  return {
    path = path,
    objectName = DiscoveryObjectName(object),
    ownership = InferOwnershipFromPath(path),
    source = object.sourceNodeID or object.sourceNodeId or object.fromNodeID or object.fromNodeId or object.source or object.from or object.parent,
    target = object.targetNodeID or object.targetNodeId or object.toNodeID or object.toNodeId or object.target or object.to or object.child,
    requirementCount = SafeTableCount(object.requirements or object.prerequisites, 50),
  }
end

local function NormalizeNodeTypeFromObject(object)
  if type(object) ~= "table" then return nil end
  local shapeType = NodeTypeFromShape(NodeShapeFromObject(object))
  if shapeType then return shapeType end
  local rawType = object.nodeType or object.type or object.shape or object.buttonType
  if type(rawType) == "string" then
    local lower = string.lower(rawType)
    if lower:find("choice") or lower:find("split") or lower:find("oct") then return "choice" end
    if lower:find("passive") or lower:find("circle") then return "passive" end
    if lower:find("active") or lower:find("square") or lower:find("spell") then return "active" end
  end
  if object.isChoice == true or object.choice == true then return "choice" end
  if object.isPassive == true or object.passive == true then return "passive" end
  if object.isActive == true or object.active == true then return "active" end
  return nil
end

local function AutoGrantedFromObject(object)
  if type(object) ~= "table" then return nil end
  if object.autoGranted ~= nil then return object.autoGranted == true end
  if object.isAutoGranted ~= nil then return object.isAutoGranted == true end
  return nil
end

local function ExtractCandidateNodeRecord(object, path)
  if type(object) ~= "table" then return nil end
  local advancementId = object.CharacterAdvancementID
    or object.characterAdvancementID
    or object.characterAdvancementId
    or object.advancementID
    or object.advancementId
    or object.nodeID
    or object.nodeId
    or object.talentID
    or object.talentId
    or object.id
  local spellId = object.spellID or object.spellId
  local name = object.name or object.Name or object.talentName or object.spellName
  local nodeShape = NodeShapeFromObject(object)
  local nodeType = NormalizeNodeTypeFromObject(object)
  local autoGranted = AutoGrantedFromObject(object)
  if not advancementId and not spellId and not name and not nodeType and autoGranted == nil then return nil end
  return {
    path = path,
    objectName = DiscoveryObjectName(object),
    ownership = InferOwnershipFromPath(path),
    advancementId = advancementId,
    spellId = spellId,
    name = name,
    nodeShape = nodeShape,
    nodeType = nodeType,
    autoGranted = autoGranted,
    x = object.x or object.posX or object.gridX or object.column,
    y = object.y or object.posY or object.gridY or object.row,
    rank = object.rank or object.currentRank,
    maxRank = object.maxRank,
    pointPool = object.pointPool or object.pool or object.treeType,
    canRefund = object.canRefund or object.refundable,
    locked = object.locked or object.isLocked,
  }
end

local function SnapshotObject(object, path, depth, seen, output)
  if type(object) ~= "table" then return end
  if seen[object] then return end
  if depth > DISCOVERY_MAX_DEPTH then return end
  if #output.objects >= DISCOVERY_MAX_OBJECTS then return end
  seen[object] = true
  output.progress.visited = output.progress.visited + 1
  output.progress.maxDepthReached = math.max(output.progress.maxDepthReached or 0, depth)
  if output.progress.visited == 1 or output.progress.visited % DISCOVERY_PROGRESS_INTERVAL == 0 then
    Debug("discover progress: visited=" .. tostring(output.progress.visited)
      .. " depth=" .. tostring(depth)
      .. " candidates=" .. tostring(#output.candidateNodes)
      .. " path=" .. tostring(path))
  end
  local snapshot = {
    path = path,
    objectName = DiscoveryObjectName(object),
    objectType = SafeObjectType(object),
    tableCount = SafeTableCount(object, DISCOVERY_MAX_FIELDS),
    primitiveFields = {},
    tableFields = {},
    methodFields = {},
    watchedFields = {},
    metatable = MetatableSummary(object),
    ownership = InferOwnershipFromPath(path),
  }
  local iterator, state, initial = SafePairs(object)
  if iterator then
    local primitiveCount = 0
    local tableCount = 0
    local methodCount = 0
    for key, value in iterator, state, initial do
      if primitiveCount + tableCount + methodCount >= DISCOVERY_MAX_FIELDS then break end
      local keyString = tostring(key)
      local valueType = type(value)
      if IsPrimitive(value) and primitiveCount < DISCOVERY_MAX_FIELDS then
        snapshot.primitiveFields[keyString] = value
        primitiveCount = primitiveCount + 1
      elseif valueType == "table" and tableCount < DISCOVERY_MAX_CHILDREN_PER_OBJECT then
        table.insert(snapshot.tableFields, {
          key = keyString,
          objectName = DiscoveryObjectName(value),
          tableCount = SafeTableCount(value, DISCOVERY_MAX_FIELDS),
        })
        tableCount = tableCount + 1
      elseif valueType == "function" and methodCount < DISCOVERY_MAX_FIELDS then
        table.insert(snapshot.methodFields, keyString)
        methodCount = methodCount + 1
      end
    end
  else
    snapshot.iterationFailed = true
  end
  for _, key in ipairs(DISCOVERY_FIELD_NAMES) do
    local value = SafeField(object, key)
    if IsPrimitive(value) then
      snapshot.watchedFields[key] = value
    elseif type(value) == "table" then
      snapshot.watchedFields[key] = {
        objectName = DiscoveryObjectName(value),
        tableCount = SafeTableCount(value, DISCOVERY_MAX_FIELDS),
      }
      table.insert(output.providerNames, path .. "." .. key)
      if #output.providerNames <= 12 then Debug("provider candidate: " .. path .. "." .. key) end
    end
  end
  for _, key in ipairs(NODE_TYPE_FIELD_NAMES) do
    local value = SafeField(object, key)
    if IsPrimitive(value) then snapshot.watchedFields[key] = value end
  end
  table.insert(output.objects, snapshot)
  local okCandidate, candidate = pcall(ExtractCandidateNodeRecord, object, path)
  if not okCandidate then output.progress.candidateErrors = output.progress.candidateErrors + 1 end
  if candidate then table.insert(output.candidateNodes, candidate) end
  local okEdge, edge = pcall(ExtractCandidateEdgeRecord, object, path)
  if not okEdge then output.progress.edgeErrors = output.progress.edgeErrors + 1 end
  if edge then table.insert(output.candidateEdges, edge) end
  for _, key in ipairs(DISCOVERY_FIELD_NAMES) do
    local value = SafeField(object, key)
    if type(value) == "table" then
      SnapshotObject(value, path .. "." .. key, depth + 1, seen, output)
    end
  end
end

local function DiscoverTalentData(root)
  local output = {
    roots = {},
    objects = {},
    candidateNodes = {},
    candidateEdges = {},
    providerNames = {},
    progress = {
      visited = 0,
      candidateErrors = 0,
      edgeErrors = 0,
      rootErrors = 0,
      maxDepthReached = 0,
    },
  }
  local seen = {}
  Debug("discover roots: " .. tostring(#DISCOVERY_ROOT_NAMES))
  for _, name in ipairs(DISCOVERY_ROOT_NAMES) do
    local object = _G[name]
    table.insert(output.roots, {
      name = name,
      found = object ~= nil,
      objectName = DiscoveryObjectName(object),
      objectType = SafeObjectType(object),
      tableCount = SafeTableCount(object, DISCOVERY_MAX_FIELDS),
    })
    Debug("discover root: " .. name .. " found=" .. tostring(object ~= nil))
    local ok, err = pcall(SnapshotObject, object, name, 0, seen, output)
    if not ok then
      output.progress.rootErrors = output.progress.rootErrors + 1
      Debug("discover root error: " .. name .. " " .. tostring(err))
    end
  end
  local ok, err = pcall(SnapshotObject, root, "selectedRoot", 0, seen, output)
  if not ok then
    output.progress.rootErrors = output.progress.rootErrors + 1
    Debug("discover selectedRoot error: " .. tostring(err))
  end
  Debug("discover traversal done: visited=" .. tostring(output.progress.visited)
    .. " providers=" .. tostring(#output.providerNames)
    .. " candidates=" .. tostring(#output.candidateNodes))
  return output
end

local function BuildDiscoverySummary(discovery)
  local summary = {
    objectCountsByType = {},
    ownershipCounts = {},
    nodeLikeTableCount = #(discovery.candidateNodes or {}),
    connectionLikeTableCount = #(discovery.candidateEdges or {}),
    normalizedBuckets = NormalizeDiscoveryBuckets(discovery.candidateNodes),
    sharedCandidateNodeFields = {},
    activeObjectContainers = {},
    inactiveObjectContainers = {},
    nodePoolContainers = {},
    buttonPoolContainers = {},
    elementDataContainers = {},
    scrollContainers = {},
  }

  local shared = nil
  for _, candidate in ipairs(discovery.candidateNodes or {}) do
    IncrementCount(summary.ownershipCounts, candidate.ownership or "unknown")
    local fields = {}
    for key, value in pairs(candidate) do
      if value ~= nil then fields[key] = true end
    end
    if not shared then
      shared = fields
    else
      for key in pairs(shared) do
        if not fields[key] then shared[key] = nil end
      end
    end
  end

  if shared then
    for key in pairs(shared) do table.insert(summary.sharedCandidateNodeFields, key) end
  end

  for _, object in ipairs(discovery.objects or {}) do
    IncrementCount(summary.objectCountsByType, object.objectType or "table")
    local ownership = object.ownership or InferOwnershipFromPath(object.path)
    IncrementCount(summary.ownershipCounts, ownership or "unknown")
    for _, field in ipairs(object.tableFields or {}) do
      local lower = string.lower(field.key or "")
      local record = { path = object.path, key = field.key, tableCount = field.tableCount, objectName = field.objectName }
      if lower == "activeobjects" then table.insert(summary.activeObjectContainers, record) end
      if lower == "inactiveobjects" then table.insert(summary.inactiveObjectContainers, record) end
      if lower == "nodepool" then table.insert(summary.nodePoolContainers, record) end
      if lower == "buttonpool" then table.insert(summary.buttonPoolContainers, record) end
      if lower == "elementdata" then table.insert(summary.elementDataContainers, record) end
      if lower == "scrollbox" or lower == "scrollchild" then table.insert(summary.scrollContainers, record) end
    end
  end

  return summary
end

local function CaptureAnchors(frame)
  local anchors = {}
  if not frame.GetNumPoints or not frame.GetPoint then return anchors end

  for index = 1, frame:GetNumPoints() do
    local point, relativeTo, relativePoint, xOfs, yOfs = frame:GetPoint(index)
    table.insert(anchors, {
      index = index,
      point = point,
      relativeTo = FrameName(relativeTo),
      relativePoint = relativePoint,
      xOfs = xOfs,
      yOfs = yOfs,
    })
  end

  return anchors
end

local function CapturePosition(frame, root)
  local left = SafeCall(frame, "GetLeft")
  local right = SafeCall(frame, "GetRight")
  local top = SafeCall(frame, "GetTop")
  local bottom = SafeCall(frame, "GetBottom")
  local centerX = left and right and ((left + right) / 2) or nil
  local centerY = top and bottom and ((top + bottom) / 2) or nil
  local rootLeft = root and SafeCall(root, "GetLeft") or nil
  local rootTop = root and SafeCall(root, "GetTop") or nil

  return {
    left = left,
    right = right,
    top = top,
    bottom = bottom,
    centerX = centerX,
    centerY = centerY,
    relativeToRoot = {
      x = centerX and rootLeft and (centerX - rootLeft) or nil,
      y = centerY and rootTop and (rootTop - centerY) or nil,
    },
    width = SafeCall(frame, "GetWidth"),
    height = SafeCall(frame, "GetHeight"),
  }
end

local function TextureFromObject(object)
  if object and object.GetTexture then
    local ok, texture = pcall(object.GetTexture, object)
    if ok and texture then return texture end
  end
  return nil
end

local function SearchChildTextures(frame, depth, seen)
  if not frame or seen[frame] or depth > 8 then return nil end
  seen[frame] = true

  local texture = TextureFromObject(frame)
  if texture then return texture, "self", FrameName(frame) end

  if frame.GetRegions then
    local regions = { frame:GetRegions() }
    for _, region in ipairs(regions) do
      texture = TextureFromObject(region)
      if texture then return texture, "region", FrameName(region) end
    end
  end

  if frame.GetChildren then
    local children = { frame:GetChildren() }
    for _, child in ipairs(children) do
      texture = TextureFromObject(child)
      if texture then return texture, "child", FrameName(child) end
      local nestedTexture, nestedSource, nestedName = SearchChildTextures(child, depth + 1, seen)
      if nestedTexture then return nestedTexture, nestedSource, nestedName end
    end
  end

  return nil
end

local function FindIconTexture(frame)
  if not frame then return nil end

  local frameName = FrameName(frame)
  local candidates = {
    frame.Icon,
    frame.icon,
    frame.iconTexture,
    frame.Texture,
    frame.texture,
  }

  for _, candidate in ipairs(candidates) do
    local texture = TextureFromObject(candidate)
    if texture then
      Debug("icon found from direct field for " .. tostring(frameName) .. ": " .. tostring(texture))
      return texture, "field", FrameName(candidate)
    end
  end

  if frameName then
    local namedIcon = _G[frameName .. "Icon"]
    local texture = TextureFromObject(namedIcon)
    if texture then
      Debug("icon found from named Icon for " .. tostring(frameName) .. ": " .. tostring(texture))
      return texture, "named-child", FrameName(namedIcon)
    end
  end

  local texture, source, sourceName = SearchChildTextures(frame, 0, {})
  if texture then
    Debug("icon found recursively for " .. tostring(frameName) .. ": " .. tostring(texture))
    return texture, source, sourceName
  end

  Debug("icon missing for " .. tostring(frameName))
  return nil, nil, nil
end

local function CaptureTooltipHandlers(frame)
  if not frame.GetScript then return {} end
  return {
    hasOnEnter = frame:GetScript("OnEnter") ~= nil,
    hasOnLeave = frame:GetScript("OnLeave") ~= nil,
    hasOnClick = frame:GetScript("OnClick") ~= nil,
  }
end

local function ReadGameTooltipLines()
  local lines = {}
  if not GameTooltip or not GameTooltip.GetName or not GameTooltip.NumLines then return lines end

  local tooltipName = GameTooltip:GetName()
  local lineCount = GameTooltip:NumLines() or 0
  Debug("tooltip line count=" .. tostring(lineCount))

  for index = 1, lineCount do
    local left = _G[tooltipName .. "TextLeft" .. index]
    local right = _G[tooltipName .. "TextRight" .. index]
    local leftText = left and left.GetText and left:GetText() or nil
    local rightText = right and right.GetText and right:GetText() or nil
    Debug("tooltip line " .. tostring(index) .. " left=" .. tostring(leftText) .. " right=" .. tostring(rightText))
    table.insert(lines, { index = index, left = leftText, right = rightText })
  end

  return lines
end

local function TryScrapeTooltip(frame)
  local result = { attempted = false, success = false, lines = {} }
  if not frame.GetScript then return result end

  local onEnter = frame:GetScript("OnEnter")
  if not onEnter then
    Debug("tooltip skipped no OnEnter for " .. tostring(FrameName(frame)))
    return result
  end

  result.attempted = true
  Debug("tooltip attempting OnEnter for " .. tostring(FrameName(frame)))

  if GameTooltip and GameTooltip.SetOwner then
    pcall(GameTooltip.SetOwner, GameTooltip, UIParent, "ANCHOR_NONE")
  end

  local ok, err = pcall(onEnter, frame)
  if ok then
    result.lines = ReadGameTooltipLines()
    result.success = #result.lines > 0
    Debug("tooltip success=" .. tostring(result.success) .. " for " .. tostring(FrameName(frame)))
  else
    result.error = tostring(err)
    Debug("tooltip error for " .. tostring(FrameName(frame)) .. ": " .. tostring(err))
  end

  if GameTooltip and GameTooltip.Hide then pcall(GameTooltip.Hide, GameTooltip) end
  return result
end

local function ExtractTextFromTooltip(tooltip)
  local name, description, rank
  if not tooltip or not tooltip.lines then return nil, nil, nil end

  for _, line in ipairs(tooltip.lines) do
    local text = line.left
    if text and text ~= "" then
      if not name then
        name = text
      elseif not rank and (text:find("Rank") or text:find("%d+/%d+")) then
        rank = text
      elseif not description then
        description = text
      else
        description = description .. "\n" .. text
      end
    end
  end

  return name, description, rank
end

local function ExtractPrimitiveFields(frame)
  local fields = {}
  local keys = {
    "CharacterAdvancementID",
    "characterAdvancementID",
    "characterAdvancementId",
    "advancementID",
    "advancementId",
    "nodeID",
    "nodeId",
    "talentID",
    "talentId",
    "spellID",
    "spellId",
    "rank",
    "currentRank",
    "maxRank",
    "locked",
    "isLocked",
  }

  for _, key in ipairs(keys) do
    local value = frame[key]
    if type(value) == "string" or type(value) == "number" or type(value) == "boolean" then
      fields[key] = value
    end
  end

  return fields
end

local function BestAdvancementId(fields)
  return fields.CharacterAdvancementID
    or fields.characterAdvancementID
    or fields.characterAdvancementId
    or fields.advancementID
    or fields.advancementId
    or fields.nodeID
    or fields.nodeId
    or fields.talentID
    or fields.talentId
end

local function CaptureNode(frame, root)
  local iconTexture, iconSource, iconSourceName = FindIconTexture(frame)
  local tooltip = TryScrapeTooltip(frame)
  local primitiveFields = ExtractPrimitiveFields(frame)
  local name, description, rank = ExtractTextFromTooltip(tooltip)
  local isShown = frame.IsShown and frame:IsShown() or nil
  local isVisible = frame.IsVisible and frame:IsVisible() or nil

  if isShown == false or isVisible == false then
    Debug("hidden/inactive node captured: " .. tostring(FrameName(frame)) .. " shown=" .. tostring(isShown) .. " visible=" .. tostring(isVisible))
  end

  -- Infer tree type from frame name (anchor-based inference happens at lattice time).
  local fNameLower = string.lower(FrameName(frame) or "")
  local treeType = "unknown"
  if fNameLower:find("classtree") then treeType = "class"
  elseif fNameLower:find("spectree") then treeType = "spec"
  elseif fNameLower:find("sidebar") or fNameLower:find("ascension") then treeType = "ascension" end

  return {
    frameName = FrameName(frame),
    objectType = frame.GetObjectType and frame:GetObjectType() or nil,
    isShown = isShown,
    isVisible = isVisible,
    treeType = treeType,
    dimensions = { width = SafeCall(frame, "GetWidth"), height = SafeCall(frame, "GetHeight") },
    position = CapturePosition(frame, root),
    anchors = CaptureAnchors(frame),
    iconTexture = iconTexture,
    iconSource = iconSource,
    iconSourceName = iconSourceName,
    tooltipHandlers = CaptureTooltipHandlers(frame),
    tooltip = tooltip,
    primitiveFields = primitiveFields,
    nodeShape = NodeShapeFromObject(frame),
    nodeType = NormalizeNodeTypeFromObject(frame),
    autoGranted = AutoGrantedFromObject(frame),
    advancementId = BestAdvancementId(primitiveFields),
    parsedName = name,
    parsedDescription = description,
    parsedRank = rank,
    locked = primitiveFields.locked or primitiveFields.isLocked,
  }
end

-- ── Inspect: full frame topology dump ───────────────────────────────────────

local function SafeGetTemplate(frame)
  -- WoW exposes GetDebugName on some frames; template can sometimes be inferred
  -- from the debug name or the frame's scripted XML ancestry.
  if frame.GetDebugName then
    local ok, name = pcall(frame.GetDebugName, frame)
    if ok and name then return name end
  end
  return nil
end

local function CaptureAllTextures(frame)
  local textures = {}
  if frame.GetRegions then
    local regions = { frame:GetRegions() }
    for i, region in ipairs(regions) do
      local regionType = region.GetObjectType and region:GetObjectType() or "unknown"
      local path = nil
      if region.GetTexture then
        local ok, t = pcall(region.GetTexture, region)
        if ok then path = t end
      end
      table.insert(textures, {
        index = i,
        regionType = regionType,
        name = FrameName(region),
        texture = path,
      })
    end
  end
  return textures
end

local function CaptureTooltipOwnership(frame)
  if not frame.GetScript then return nil end
  local owner = nil
  -- Some frames store their tooltip owner reference directly.
  if type(frame.tooltipOwner) == "table" then
    owner = FrameName(frame.tooltipOwner)
  elseif type(frame.tooltip) == "table" then
    owner = FrameName(frame.tooltip)
  elseif type(frame.GameTooltip) == "table" then
    owner = FrameName(frame.GameTooltip)
  end
  return {
    hasOnEnter = frame:GetScript("OnEnter") ~= nil,
    hasOnLeave = frame:GetScript("OnLeave") ~= nil,
    hasOnClick = frame:GetScript("OnClick") ~= nil,
    inferredOwner = owner,
  }
end

local function InspectFrame(frame)
  if not frame then return nil end
  local root = FindRootFrame()

  local name = FrameName(frame)
  local parentName = nil
  if frame.GetParent then
    local ok, par = pcall(frame.GetParent, frame)
    if ok and par then parentName = FrameName(par) end
  end

  local childCount = 0
  if frame.GetNumChildren then
    local ok, n = pcall(frame.GetNumChildren, frame)
    if ok then childCount = n or 0 end
  end

  local regionCount = 0
  if frame.GetNumRegions then
    local ok, n = pcall(frame.GetNumRegions, frame)
    if ok then regionCount = n or 0 end
  end

  local strata, frameLevel = nil, nil
  if frame.GetFrameStrata then
    local ok, s = pcall(frame.GetFrameStrata, frame)
    if ok then strata = s end
  end
  if frame.GetFrameLevel then
    local ok, l = pcall(frame.GetFrameLevel, frame)
    if ok then frameLevel = l end
  end

  local isShown = frame.IsShown and frame:IsShown() or nil
  local isVisible = frame.IsVisible and frame:IsVisible() or nil

  local absPos = CapturePosition(frame, root)
  local anchors = CaptureAnchors(frame)
  local textures = CaptureAllTextures(frame)
  local template = SafeGetTemplate(frame)
  local tooltipOwnership = CaptureTooltipOwnership(frame)

  local primitiveFields = ExtractPrimitiveFields(frame)

  return {
    frameName = name,
    parentName = parentName,
    templateType = template,
    objectType = frame.GetObjectType and frame:GetObjectType() or nil,
    frameStrata = strata,
    frameLevel = frameLevel,
    isShown = isShown,
    isVisible = isVisible,
    childCount = childCount,
    regionCount = regionCount,
    dimensions = { width = SafeCall(frame, "GetWidth"), height = SafeCall(frame, "GetHeight") },
    absolutePosition = absPos,
    anchors = anchors,
    textures = textures,
    tooltipOwnership = tooltipOwnership,
    primitiveFields = primitiveFields,
    nodeShape = NodeShapeFromObject(frame),
    nodeType = NormalizeNodeTypeFromObject(frame),
    advancementId = BestAdvancementId(primitiveFields),
  }
end

-- ── Deterministic lattice derivation from authored anchor offsets ──────────────
-- Talent nodes are anchored TOPLEFT→TOPLEFT relative to their tree root frame
-- (CoATalentFrameTreeViewClassTree or ...SpecTree). The xOfs/yOfs values ARE the
-- canonical authored grid coordinates. No heuristic clustering is needed — we round
-- to integer, build unique sorted sets, and assign 1-based indices.
--
-- Each tree (class, spec, ascension) maintains its own independent coordinate system.
-- The previous >7 column warning was caused by merging nodes across trees.

local LATTICE_MAX_ROWS = 10
local LATTICE_MAX_COLS = 7

-- ── Tree type inference ──────────────────────────────────────────────────────

local TREE_ROOT_NAMES = {
  class = {
    "CoATalentFrameTreeViewClassTree",
    "CoATalentFrameTreeViewClassTreePool",
  },
  spec = {
    "CoATalentFrameTreeViewSpecTree",
    "CoATalentFrameTreeViewSpecTreePool",
  },
  ascension = {
    "CoATalentFrameTreeViewSidebar",
    "CoATalentFrameTreeViewAscension",
  },
}

local function InferTreeType(frame)
  -- Primary: check the anchor relativeTo field — this is the most reliable signal.
  if frame.GetNumPoints and frame.GetPoint then
    local ok, nPts = pcall(frame.GetNumPoints, frame)
    if ok and nPts and nPts >= 1 then
      local ok2, pt, relTo = pcall(frame.GetPoint, frame, 1)
      if ok2 and relTo then
        local relName = FrameName(relTo) or ""
        local rl = string.lower(relName)
        if rl:find("classtree") then return "class" end
        if rl:find("spectree") then return "spec" end
        if rl:find("sidebar") or rl:find("ascension") then return "ascension" end
      end
    end
  end
  -- Fallback: walk parent chain.
  local current = frame
  for _ = 1, 10 do
    if not current or not current.GetParent then break end
    local ok, par = pcall(current.GetParent, current)
    if not ok or not par then break end
    local pName = string.lower(FrameName(par) or "")
    if pName:find("classtree") then return "class" end
    if pName:find("spectree") then return "spec" end
    if pName:find("sidebar") or pName:find("ascension") then return "ascension" end
    current = par
  end
  -- Last resort: frame name itself.
  local fName = string.lower(FrameName(frame) or "")
  if fName:find("classtree") then return "class" end
  if fName:find("spectree") then return "spec" end
  if fName:find("sidebar") or fName:find("ascension") then return "ascension" end
  return "unknown"
end

-- ── Node classification helpers ──────────────────────────────────────────────

local function ClassifyNodeVisibility(frame)
  -- Returns "visible", "hidden", or "pooled"
  local isShown = frame.IsShown and frame:IsShown()
  local isVisible = frame.IsVisible and frame:IsVisible()
  if not isShown and not isVisible then
    -- Check if the frame has valid anchor data — pooled frames often lack it
    local hasAnchor = false
    if frame.GetNumPoints then
      local ok, n = pcall(frame.GetNumPoints, frame)
      hasAnchor = ok and n and n >= 1
    end
    if not hasAnchor then return "pooled" end
    return "hidden"
  end
  if isShown and not isVisible then return "hidden" end
  return "visible"
end

local function IsChoiceNode(frame)
  local shape = NodeShapeFromObject(frame)
  if shape == "octagon" then return true end
  local fName = string.lower(FrameName(frame) or "")
  return (fName:find("oct") or fName:find("choice") or fName:find("split")) ~= nil
end

-- ── Extract deterministic anchor coordinates ─────────────────────────────────

local function ExtractAnchorCoords(frame)
  -- Returns anchorX, anchorY, relativeParent or nil,nil,nil
  if not frame.GetNumPoints or not frame.GetPoint then return nil, nil, nil end
  local ok, nPts = pcall(frame.GetNumPoints, frame)
  if not ok or not nPts or nPts < 1 then return nil, nil, nil end
  local ok2, point, relativeTo, relativePoint, xOfs, yOfs = pcall(frame.GetPoint, frame, 1)
  if not ok2 then return nil, nil, nil end
  if type(xOfs) ~= "number" or type(yOfs) ~= "number" then return nil, nil, nil end
  local relName = FrameName(relativeTo)
  return math.floor(xOfs + 0.5), math.floor(yOfs + 0.5), relName
end

-- ── Unique-sorted set builder ────────────────────────────────────────────────

local function BuildUniqueSorted(values)
  local seen = {}
  local unique = {}
  for _, v in ipairs(values) do
    if not seen[v] then
      seen[v] = true
      table.insert(unique, v)
    end
  end
  table.sort(unique)
  return unique
end

local function IndexOf(sortedSet, value)
  for i, v in ipairs(sortedSet) do
    if v == value then return i end
  end
  return nil
end

-- ── Choice node child detection ──────────────────────────────────────────────

local function DetectChoiceChildren(frame)
  -- Choice/octagon container frames may have child node buttons as sub-options.
  local children = {}
  if not frame.GetChildren then return children end
  local ok, kids = pcall(function() return { frame:GetChildren() } end)
  if not ok or not kids then return children end
  for _, child in ipairs(kids) do
    if IsTalentNodeFrame(child) then
      table.insert(children, FrameName(child))
    end
  end
  return children
end

-- ── Main deterministic lattice derivation ────────────────────────────────────

local function DeriveDeterministicLattice()
  EnsureDB()

  if not IsTalentUIOpen() then
    PrintError("CoA talent UI is not visible. Open the talent window first.")
    return nil
  end

  -- Traverse ALL known tree roots to collect frames from every tree.
  -- FindRootFrame() only returns the first match (usually SpecTree), which
  -- misses ClassTree and Ascension nodes that live under sibling roots.
  local LATTICE_ROOTS = {
    "CoATalentFrameTreeViewClassTree",
    "CoATalentFrameTreeViewSpecTree",
    "CoATalentFrameTreeViewSidebar",
    "CoATalentFrameTreeViewAscension",
    "CoATalentFrameTreeView",   -- fallback parent that contains all subtrees
    "CoATalentFrame",           -- top-level fallback
  }

  local allFrames = {}
  local seen = {}
  local rootsFound = 0
  for _, rName in ipairs(LATTICE_ROOTS) do
    local rFrame = _G[rName]
    if rFrame and type(rFrame) == "table" and rFrame.GetName then
      rootsFound = rootsFound + 1
      TraverseFrame(rFrame, allFrames, 0, seen)
    end
  end

  if rootsFound == 0 then
    PrintError("No CoA talent root frame found.")
    return nil
  end

  Debug("lattice: traversed " .. rootsFound .. " roots, " .. #allFrames .. " total frames collected")

  -- Classify every talent node frame.
  local visibleNodes = {}
  local hiddenNodes = {}
  local pooledNodes = {}
  local skippedReasons = {}

  for _, frame in ipairs(allFrames) do
    if IsTalentNodeFrame(frame) then
      local visibility = ClassifyNodeVisibility(frame)
      local fName = FrameName(frame)
      local treeType = InferTreeType(frame)
      local anchorX, anchorY, relParent = ExtractAnchorCoords(frame)
      local shape = NodeShapeFromObject(frame)
      local nType = NormalizeNodeTypeFromObject(frame)
      local primitives = ExtractPrimitiveFields(frame)
      local advId = BestAdvancementId(primitives)
      local isChoice = IsChoiceNode(frame)
      local choiceChildren = isChoice and DetectChoiceChildren(frame) or nil
      local template = SafeGetTemplate(frame)

      local strata, frameLevel = nil, nil
      if frame.GetFrameStrata then
        local ok, s = pcall(frame.GetFrameStrata, frame); if ok then strata = s end
      end
      if frame.GetFrameLevel then
        local ok, l = pcall(frame.GetFrameLevel, frame); if ok then frameLevel = l end
      end

      local nodeRecord = {
        frameName = fName,
        treeType = treeType,
        anchorX = anchorX,
        anchorY = anchorY and -anchorY or nil,  -- yOfs is negative (downward), flip to positive
        relativeParent = relParent,
        nodeShape = shape,
        nodeType = nType,
        isChoice = isChoice,
        choiceChildren = choiceChildren,
        choiceVariantCount = choiceChildren and #choiceChildren or nil,
        advancementId = advId,
        visibility = visibility,
        frameTemplate = template,
        frameStrata = strata,
        frameLevel = frameLevel,
        dimensions = {
          width = SafeCall(frame, "GetWidth"),
          height = SafeCall(frame, "GetHeight"),
        },
        primitiveFields = primitives,
      }

      if visibility == "visible" then
        if anchorX and anchorY then
          table.insert(visibleNodes, nodeRecord)
        else
          table.insert(skippedReasons, fName .. ": visible but missing anchor data")
          table.insert(hiddenNodes, nodeRecord)
        end
      elseif visibility == "hidden" then
        table.insert(hiddenNodes, nodeRecord)
      else
        table.insert(pooledNodes, nodeRecord)
      end
    end
  end

  -- Build per-tree independent lattices.
  local trees = { class = {}, spec = {}, ascension = {} }
  for _, node in ipairs(visibleNodes) do
    local t = node.treeType
    if t == "class" or t == "spec" or t == "ascension" then
      table.insert(trees[t], node)
    else
      -- Assign unknown tree nodes to spec as fallback
      table.insert(trees.spec, node)
      Debug("lattice: unknown tree type for " .. tostring(node.frameName) .. ", assigned to spec")
    end
  end

  local treeResults = {}
  for treeName, treeNodes in pairs(trees) do
    if #treeNodes > 0 then
      -- Collect unique sorted X and Y sets from anchor offsets.
      local xVals, yVals = {}, {}
      for _, n in ipairs(treeNodes) do
        table.insert(xVals, n.anchorX)
        -- anchorY is already flipped to positive (top-to-bottom increasing)
        table.insert(yVals, n.anchorY)
      end

      local uniqueX = BuildUniqueSorted(xVals)
      local uniqueY = BuildUniqueSorted(yVals)

      -- Assign canonical row/col indices.
      local grid = {}
      local collisions = {}
      local occupiedCells = {}
      for _, n in ipairs(treeNodes) do
        local col = IndexOf(uniqueX, n.anchorX)
        local row = IndexOf(uniqueY, n.anchorY)
        n.canonicalRow = row
        n.canonicalCol = col
        n.localTreeX = n.anchorX
        n.localTreeY = n.anchorY

        local cellKey = row .. "," .. col
        if occupiedCells[cellKey] then
          table.insert(collisions, {
            cell = cellKey,
            existing = occupiedCells[cellKey],
            duplicate = n.frameName,
          })
        else
          occupiedCells[cellKey] = n.frameName
        end

        table.insert(grid, n)
      end

      -- Build row/col summaries.
      local rowOccupancy = {}
      for _, n in ipairs(grid) do
        rowOccupancy[n.canonicalRow] = (rowOccupancy[n.canonicalRow] or 0) + 1
      end
      local colOccupancy = {}
      for _, n in ipairs(grid) do
        colOccupancy[n.canonicalCol] = (colOccupancy[n.canonicalCol] or 0) + 1
      end

      local rows = {}
      for i, yVal in ipairs(uniqueY) do
        table.insert(rows, { rowIndex = i, anchorY = yVal, nodeCount = rowOccupancy[i] or 0 })
      end
      local cols = {}
      for i, xVal in ipairs(uniqueX) do
        table.insert(cols, { colIndex = i, anchorX = xVal, nodeCount = colOccupancy[i] or 0 })
      end

      treeResults[treeName] = {
        treeType = treeName,
        nodeCount = #treeNodes,
        rowCount = #uniqueY,
        colCount = #uniqueX,
        uniqueX = uniqueX,
        uniqueY = uniqueY,
        rows = rows,
        cols = cols,
        grid = grid,
        collisions = collisions,
      }
    end
  end

  -- Build the lattice record.
  local record = {
    capturedAt = date and date("%Y-%m-%d %H:%M:%S") or "unknown",
    addonVersion = "1.0.0",
    visibleNodeCount = #visibleNodes,
    hiddenNodeCount = #hiddenNodes,
    pooledNodeCount = #pooledNodes,
    skippedReasons = skippedReasons,
    trees = treeResults,
    hiddenNodes = hiddenNodes,
    pooledNodes = pooledNodes,
  }
  table.insert(CoATalentExtractorDB.lattice, record)

  -- ── Chat output ──────────────────────────────────────────────────────────
  PrintHeader("Deterministic Lattice")
  PrintKV("Visible nodes", #visibleNodes)
  PrintKV("Hidden nodes", #hiddenNodes)
  PrintKV("Pooled nodes", #pooledNodes)

  for treeName, tr in pairs(treeResults) do
    PrintHeader(treeName .. " tree")
    PrintKV("Nodes", tr.nodeCount)
    PrintKV("Rows", tr.rowCount)
    PrintKV("Cols", tr.colCount)

    if tr.rowCount > LATTICE_MAX_ROWS then
      PrintError("WARNING: " .. treeName .. " has more than " .. LATTICE_MAX_ROWS .. " rows")
    end
    if tr.colCount > LATTICE_MAX_COLS then
      PrintError("WARNING: " .. treeName .. " has more than " .. LATTICE_MAX_COLS .. " cols")
    end

    -- Row occupancy summary.
    local occ = ""
    for i, r in ipairs(tr.rows) do
      occ = occ .. (i > 1 and ", " or "") .. r.nodeCount
    end
    PrintKV("Row occupancy", occ)

    -- Unique coordinate sets.
    local xStr = ""
    for i, v in ipairs(tr.uniqueX) do xStr = xStr .. (i > 1 and ", " or "") .. v end
    local yStr = ""
    for i, v in ipairs(tr.uniqueY) do yStr = yStr .. (i > 1 and ", " or "") .. v end
    Debug("lattice " .. treeName .. " X set: " .. xStr)
    Debug("lattice " .. treeName .. " Y set: " .. yStr)

    -- Collisions.
    if #tr.collisions > 0 then
      PrintError("Coordinate collisions in " .. treeName .. ":")
      for _, c in ipairs(tr.collisions) do
        Print(C_RED .. "  cell(" .. c.cell .. "): " .. c.existing .. " vs " .. c.duplicate .. C_END)
      end
    end

    -- Per-node debug output.
    for _, n in ipairs(tr.grid) do
      Debug("  " .. tostring(n.frameName)
        .. " row=" .. tostring(n.canonicalRow)
        .. " col=" .. tostring(n.canonicalCol)
        .. " x=" .. tostring(n.anchorX)
        .. " y=" .. tostring(n.anchorY)
        .. (n.isChoice and " CHOICE" or ""))
    end
  end

  -- Skipped nodes.
  if #skippedReasons > 0 then
    Print(C_GRAY .. "Skipped nodes:" .. C_END)
    for _, reason in ipairs(skippedReasons) do
      Print(C_GRAY .. "  " .. reason .. C_END)
    end
  end

  PrintSuccess("Lattice complete.")
  return record
end

local function CaptureConnection(frame, root, nodes)
  local fields = ExtractPrimitiveFields(frame)
  local connection = {
    frameName = FrameName(frame),
    objectType = frame.GetObjectType and frame:GetObjectType() or nil,
    isShown = frame.IsShown and frame:IsShown() or nil,
    isVisible = frame.IsVisible and frame:IsVisible() or nil,
    position = CapturePosition(frame, root),
    anchors = CaptureAnchors(frame),
    primitiveFields = fields,
    sourceNodeFrame = nil,
    targetNodeFrame = nil,
  }

  if frame.GetParent then
    connection.parentFrame = FrameName(frame:GetParent())
  end

  -- Probe source/target from raw table fields: both frame refs and ID fields.
  local SOURCE_KEYS = { "source", "sourceNode", "sourceNodeFrame", "fromNode", "fromFrame", "startNode", "parentNode", "from", "parent" }
  local TARGET_KEYS = { "target", "targetNode", "targetNodeFrame", "toNode", "toFrame", "endNode",  "childNode",  "to",   "child"  }
  local SOURCE_ID_KEYS = { "sourceNodeID", "sourceNodeId", "fromNodeID", "fromNodeId", "sourceID", "sourceId" }
  local TARGET_ID_KEYS = { "targetNodeID", "targetNodeId", "toNodeID",   "toNodeId",   "targetID", "targetId"  }

  if type(frame) == "table" then
    for _, key in ipairs(SOURCE_KEYS) do
      local value = SafeField(frame, key)
      if type(value) == "table" and value.GetName then
        connection.sourceNodeFrame = FrameName(value)
        break
      end
    end
    for _, key in ipairs(TARGET_KEYS) do
      local value = SafeField(frame, key)
      if type(value) == "table" and value.GetName then
        connection.targetNodeFrame = FrameName(value)
        break
      end
    end
    for _, key in ipairs(SOURCE_ID_KEYS) do
      local value = SafeField(frame, key)
      if IsPrimitive(value) then connection.sourceNodeId = value; break end
    end
    for _, key in ipairs(TARGET_ID_KEYS) do
      local value = SafeField(frame, key)
      if IsPrimitive(value) then connection.targetNodeId = value; break end
    end
  end

  -- Capture orientation/strata for connector line frames.
  if frame.GetFrameStrata then
    local ok, s = pcall(frame.GetFrameStrata, frame) ; if ok then connection.frameStrata = s end
  end
  if frame.GetFrameLevel then
    local ok, l = pcall(frame.GetFrameLevel, frame) ; if ok then connection.frameLevel = l end
  end
  -- Some connection frames are Textures with a rotation indicating direction.
  if frame.GetTexCoord then
    local ok, a,b,c,d,e,f,g,h = pcall(frame.GetTexCoord, frame)
    if ok then connection.texCoords = { a,b,c,d,e,f,g,h } end
  end
  if frame.GetRotation then
    local ok, r = pcall(frame.GetRotation, frame) ; if ok then connection.rotation = r end
  end

  -- Texture paths for the connector graphic.
  connection.textures = CaptureAllTextures(frame)

  Debug("line/connection detected: " .. tostring(connection.frameName)
    .. " source=" .. tostring(connection.sourceNodeFrame or connection.sourceNodeId)
    .. " target=" .. tostring(connection.targetNodeFrame or connection.targetNodeId))

  return connection
end

local function BuildCapture()
  EnsureDB()

  if not IsTalentUIOpen() then
    PrintError("CoA talent UI is not visible. Open the talent window first.")
    return nil
  end

  -- Traverse ALL known tree roots (same set as DeriveDeterministicLattice) so
  -- that class-tree, spec-tree, sidebar, and ascension nodes are all captured.
  local CAPTURE_ROOTS = {
    "CoATalentFrameTreeViewClassTree",
    "CoATalentFrameTreeViewSpecTree",
    "CoATalentFrameTreeViewSidebar",
    "CoATalentFrameTreeViewAscension",
    "CoATalentFrameTreeView",
    "CoATalentFrame",
  }

  local frames = {}
  local seen = {}
  local rootName = nil
  local root = nil
  local rootsTraversed = 0
  for _, rName in ipairs(CAPTURE_ROOTS) do
    local rFrame = _G[rName]
    if rFrame and type(rFrame) == "table" and rFrame.GetName then
      if not root then root = rFrame; rootName = rName end
      rootsTraversed = rootsTraversed + 1
      TraverseFrame(rFrame, frames, 0, seen)
    end
  end

  if rootsTraversed == 0 then
    PrintError("No CoA talent root frame found.")
    return nil
  end

  Debug("capture: traversed " .. rootsTraversed .. " roots, " .. #frames .. " total frames collected")

  local nodes = {}
  local hiddenNodes = 0
  local iconSuccess = 0

  for _, scannedFrame in ipairs(frames) do
    if IsTalentNodeFrame(scannedFrame) then
      local node = CaptureNode(scannedFrame, root)
      table.insert(nodes, node)
      if node.isShown == false or node.isVisible == false then hiddenNodes = hiddenNodes + 1 end
      if node.iconTexture then iconSuccess = iconSuccess + 1 end
      Debug("node: " .. tostring(node.frameName)
        .. " adv=" .. tostring(node.advancementId)
        .. " icon=" .. tostring(node.iconTexture ~= nil))
    end
  end

  local connections = {}
  for _, scannedFrame in ipairs(frames) do
    if IsConnectionFrame(scannedFrame) then
      table.insert(connections, CaptureConnection(scannedFrame, root, nodes))
    end
  end

  local discovery = DiscoverTalentData(root)
  local discoverySummary = BuildDiscoverySummary(discovery)

  local capture = {
    capturedAt = date and date("%Y-%m-%d %H:%M:%S") or "unknown",
    addonVersion = "1.0.0",
    rootName = rootName,
    rootsTraversed = rootsTraversed,
    rootVisible = root.IsVisible and root:IsVisible() or nil,
    totalFramesScanned = #frames,
    nodesFound = #nodes,
    hiddenNodesFound = hiddenNodes,
    iconSuccessCount = iconSuccess,
    connectionCount = #connections,
    discoveryObjectCount = discovery and #discovery.objects or 0,
    discoveryCandidateNodeCount = discovery and #discovery.candidateNodes or 0,
    discoveryCandidateEdgeCount = discovery and #discovery.candidateEdges or 0,
    discoverySummary = discoverySummary,
    classTree = discoverySummary.normalizedBuckets.classTree,
    specTree = discoverySummary.normalizedBuckets.specTree,
    ascensionTrack = discoverySummary.normalizedBuckets.ascensionTrack,
    unknownDiscoveryNodes = discoverySummary.normalizedBuckets.unknown,
    nodes = nodes,
    connections = connections,
    discovery = discovery,
  }

  table.insert(CoATalentExtractorDB.captures, capture)
  LAST_CAPTURE = capture
  return capture
end

local function Scan()
  local capture = BuildCapture()
  if not capture then return end
  PrintHeader("Scan Complete")
  PrintKV("Nodes", capture.nodesFound .. " (" .. capture.hiddenNodesFound .. " hidden)")
  PrintKV("Connections", capture.connectionCount)
  PrintKV("Icons resolved", capture.iconSuccessCount)
  PrintKV("Frames scanned", capture.totalFramesScanned)
  PrintKV("Discovery nodes", capture.discoveryCandidateNodeCount)
  PrintKV("Discovery edges", capture.discoveryCandidateEdgeCount)
  PrintSaveHint()
end

local function LatestCapture()
  EnsureDB()
  if LAST_CAPTURE then return LAST_CAPTURE end
  return CoATalentExtractorDB.captures[#CoATalentExtractorDB.captures]
end

local function Dump()
  local capture = LatestCapture()
  if not capture then
    PrintError("No capture available. Run /coax scan first.")
    return
  end
  PrintHeader("Latest Capture")
  PrintKV("Captured at", capture.capturedAt)
  PrintKV("Nodes", capture.nodesFound .. " (" .. capture.hiddenNodesFound .. " hidden)")
  PrintKV("Connections", capture.connectionCount)
  PrintKV("Icons", capture.iconSuccessCount)
  PrintKV("Discovery nodes", capture.discoveryCandidateNodeCount)
  PrintKV("Discovery edges", capture.discoveryCandidateEdgeCount)
  if capture.discoverySummary then
    PrintKV("Node-like tables", capture.discoverySummary.nodeLikeTableCount)
    PrintKV("Connection-like tables", capture.discoverySummary.connectionLikeTableCount)
  end
end

local function Export()
  local capture = LatestCapture()
  if not capture then capture = BuildCapture() end
  if not capture then return end

  -- Check for lattice data — run lattice if not yet available.
  local latticeRecords = CoATalentExtractorDB.lattice or {}
  local lattice = latticeRecords[#latticeRecords]

  -- Build a lookup from frameName -> lattice node record for canonical coords.
  local latticeIndex = {}
  if lattice and lattice.trees then
    for _, tree in pairs(lattice.trees) do
      for _, n in ipairs(tree.grid or {}) do
        if n.frameName then latticeIndex[n.frameName] = n end
      end
    end
  end

  -- Build export nodes with enhanced fields.
  local visibleExport = {}
  local hiddenExport = {}
  local pooledExport = {}

  for _, node in ipairs(capture.nodes or {}) do
    local lat = latticeIndex[node.frameName]
    local isVisible = node.isVisible and node.isVisible ~= false
    local isShown = node.isShown and node.isShown ~= false

    -- Determine tree type from lattice data or from frame name.
    local treeType = lat and lat.treeType or nil
    if not treeType then
      local fn = string.lower(node.frameName or "")
      if fn:find("classtree") then treeType = "class"
      elseif fn:find("spectree") then treeType = "spec"
      elseif fn:find("sidebar") or fn:find("ascension") then treeType = "ascension"
      else treeType = "unknown" end
    end

    local record = {
      id = node.frameName,
      advancementId = node.advancementId,
      name = node.parsedName,
      description = node.parsedDescription,
      icon = node.iconTexture,
      rank = node.parsedRank or node.primitiveFields.rank or node.primitiveFields.currentRank,
      visible = node.isVisible,
      locked = node.locked,
      nodeType = node.nodeType,
      nodeShape = node.nodeShape,
      autoGranted = node.autoGranted,
      treeType = treeType,
      -- Canonical lattice coordinates (from deterministic derivation).
      canonicalRow = lat and lat.canonicalRow or nil,
      canonicalCol = lat and lat.canonicalCol or nil,
      anchorX = lat and lat.anchorX or nil,
      anchorY = lat and lat.anchorY or nil,
      localTreeX = lat and lat.localTreeX or nil,
      localTreeY = lat and lat.localTreeY or nil,
      relativeParent = lat and lat.relativeParent or nil,
      -- Frame metadata.
      frameTemplate = lat and lat.frameTemplate or nil,
      frameStrata = lat and lat.frameStrata or nil,
      frameLevel = lat and lat.frameLevel or nil,
      -- Choice node fields.
      isChoice = lat and lat.isChoice or (node.nodeType == "choice") or nil,
      choiceChildren = lat and lat.choiceChildren or nil,
      choiceVariantCount = lat and lat.choiceVariantCount or nil,
      -- Legacy position (for backward compatibility).
      x = node.position and node.position.relativeToRoot and node.position.relativeToRoot.x or nil,
      y = node.position and node.position.relativeToRoot and node.position.relativeToRoot.y or nil,
    }

    if isVisible and isShown then
      table.insert(visibleExport, record)
    elseif isShown or (node.anchors and #node.anchors > 0) then
      table.insert(hiddenExport, record)
    else
      table.insert(pooledExport, record)
    end
  end

  -- Connection export with tree type inference.
  local connectionExport = {}
  for _, conn in ipairs(capture.connections or {}) do
    local fn = string.lower(conn.frameName or "")
    local connTree = "unknown"
    if fn:find("classtree") then connTree = "class"
    elseif fn:find("spectree") then connTree = "spec"
    elseif fn:find("sidebar") or fn:find("ascension") then connTree = "ascension" end

    -- sourceNodeId/targetNodeId: prefer numeric IDs if available (rare),
    -- otherwise use the frame names which match node export IDs.
    table.insert(connectionExport, {
      id = conn.frameName,
      treeType = connTree,
      sourceNodeFrame = conn.sourceNodeFrame,
      targetNodeFrame = conn.targetNodeFrame,
      sourceNodeId = conn.sourceNodeId or conn.sourceNodeFrame,
      targetNodeId = conn.targetNodeId or conn.targetNodeFrame,
      rotation = conn.rotation,
      parentFrame = conn.parentFrame,
    })
  end

  CoATalentExtractorDB.export = {
    exportedAt = date and date("%Y-%m-%d %H:%M:%S") or "unknown",
    sourceCaptureAt = capture.capturedAt,
    hasLattice = lattice ~= nil,
    visibleNodes = visibleExport,
    hiddenNodes = hiddenExport,
    pooledNodes = pooledExport,
    connections = connectionExport,
    -- Legacy flat list for backward compatibility.
    nodes = visibleExport,
  }

  PrintHeader("Export Complete")
  PrintKV("Visible nodes", #visibleExport)
  PrintKV("Hidden nodes", #hiddenExport)
  PrintKV("Pooled nodes", #pooledExport)
  PrintKV("Connections", #connectionExport)
  PrintKV("Has lattice", lattice and "yes" or "no (run /coax lattice first)")
  PrintSaveHint()
end

local function Discover()
  EnsureDB()
  local root = FindRootFrame()
  if not root then
    PrintError("No CoA talent root frame found. Open the talent window first.")
    return
  end
  local record = {
    capturedAt = date and date("%Y-%m-%d %H:%M:%S") or "unknown",
    status = "started",
    roots = {},
    objects = {},
    candidateNodes = {},
    candidateEdges = {},
  }
  table.insert(CoATalentExtractorDB.discovery, record)
  local ok, discovery = pcall(DiscoverTalentData, root)
  if not ok then
    record.status = "error"
    record.error = tostring(discovery)
    PrintError("Discovery failed: " .. tostring(discovery))
    return
  end
  local summary = BuildDiscoverySummary(discovery)
  record.status = "complete"
  record.roots = discovery.roots
  record.objects = discovery.objects
  record.candidateNodes = discovery.candidateNodes
  record.candidateEdges = discovery.candidateEdges
  record.providerNames = discovery.providerNames
  record.progress = discovery.progress
  record.summary = summary
  record.classTree = summary.normalizedBuckets.classTree
  record.specTree = summary.normalizedBuckets.specTree
  record.ascensionTrack = summary.normalizedBuckets.ascensionTrack
  record.unknownNodes = summary.normalizedBuckets.unknown
  PrintHeader("Discovery Complete")
  PrintKV("Candidate nodes", #record.candidateNodes)
  PrintKV("Candidate edges", #record.candidateEdges)
  PrintKV("Objects visited", #record.objects)
  PrintKV("Providers found", #(record.providerNames or {}))
  PrintSaveHint()
end

local function Hover()
  EnsureDB()
  local focus = GetMouseFocus and GetMouseFocus() or nil
  if not focus then
    PrintError("No mouse focus frame found. Hover a frame and retry.")
    return
  end
  local root = FindRootFrame()
  local node = CaptureNode(focus, root)
  table.insert(CoATalentExtractorDB.hover, { capturedAt = date and date("%Y-%m-%d %H:%M:%S") or "unknown", node = node })
  PrintHeader("Hover Capture")
  PrintKV("Frame", node.frameName or "<unnamed>")
  PrintKV("Name", node.parsedName or "—")
  PrintKV("Type", (node.nodeType or "?") .. " (" .. (node.nodeShape or "?") .. ")")
  PrintKV("Advancement", node.advancementId or "—")
  PrintKV("Icon", node.iconTexture and "yes" or "missing")
  PrintSaveHint()
end

local function Inspect()
  EnsureDB()
  local focus = GetMouseFocus and GetMouseFocus() or nil
  if not focus then
    PrintError("No mouse focus frame found. Hover over a frame and run /coax inspect.")
    return
  end
  local info = InspectFrame(focus)
  if not info then PrintError("Inspect returned no data for this frame."); return end

  PrintHeader("Frame Inspect")
  PrintKV("Name", info.frameName or "<unnamed>")
  PrintKV("Parent", info.parentName or "—")
  PrintKV("Template", info.templateType or "—")
  PrintKV("Type", info.objectType or "—")
  PrintKV("Strata/Level", tostring(info.frameStrata) .. " / " .. tostring(info.frameLevel))
  PrintKV("Shown/Visible", tostring(info.isShown) .. " / " .. tostring(info.isVisible))
  PrintKV("Children/Regions", tostring(info.childCount) .. " / " .. tostring(info.regionCount))
  local d = info.dimensions
  PrintKV("Size", tostring(d.width) .. " x " .. tostring(d.height))

  local ap = info.absolutePosition
  if ap then
    PrintKV("Position (abs)", "L=" .. tostring(ap.left) .. " T=" .. tostring(ap.top)
      .. " cx=" .. tostring(ap.centerX) .. " cy=" .. tostring(ap.centerY))
    if ap.relativeToRoot then
      PrintKV("Position (rel)", "x=" .. tostring(ap.relativeToRoot.x) .. " y=" .. tostring(ap.relativeToRoot.y))
    end
  end

  if #info.anchors > 0 then
    Print(C_GRAY .. "  Anchors (" .. #info.anchors .. "):" .. C_END)
    for _, a in ipairs(info.anchors) do
      Print(C_GRAY .. "    [" .. a.index .. "] " .. C_END
        .. tostring(a.point) .. " -> " .. tostring(a.relativeTo)
        .. ":" .. tostring(a.relativePoint)
        .. " (" .. tostring(a.xOfs) .. ", " .. tostring(a.yOfs) .. ")")
    end
  end

  if #info.textures > 0 then
    Print(C_GRAY .. "  Textures (" .. #info.textures .. "):" .. C_END)
    for _, t in ipairs(info.textures) do
      if t.texture then
        Print(C_GRAY .. "    [" .. t.index .. "] " .. C_END .. tostring(t.texture))
      end
    end
  end

  if info.tooltipOwnership then
    local to = info.tooltipOwnership
    PrintKV("Tooltip", "OnEnter=" .. tostring(to.hasOnEnter)
      .. " OnLeave=" .. tostring(to.hasOnLeave)
      .. " Click=" .. tostring(to.hasOnClick))
  end
  if info.advancementId then
    PrintKV("Advancement", info.advancementId)
  end
  if info.nodeType then
    PrintKV("Node", tostring(info.nodeType) .. " (" .. tostring(info.nodeShape) .. ")")
  end

  table.insert(CoATalentExtractorDB.inspect, {
    capturedAt = date and date("%Y-%m-%d %H:%M:%S") or "unknown",
    frame = info,
  })
  PrintSaveHint()
end

local function Lattice()
  local record = DeriveDeterministicLattice()
  if not record then return end
  PrintSaveHint()
end

local function Roots()
  PrintHeader("Root Frames")
  for _, name in ipairs(ROOT_NAMES) do
    local frame = _G[name]
    if frame then
      PrintKV(name, C_GREEN .. "found" .. C_END
        .. "  shown=" .. tostring(frame.IsShown and frame:IsShown() or "?")
        .. "  visible=" .. tostring(frame.IsVisible and frame:IsVisible() or "?"))
    else
      PrintKV(name, C_RED .. "missing" .. C_END)
    end
  end
end

local function Clear()
  EnsureDB()
  CoATalentExtractorDB.captures = {}
  CoATalentExtractorDB.hover = {}
  CoATalentExtractorDB.export = {}
  CoATalentExtractorDB.discovery = {}
  CoATalentExtractorDB.inspect = {}
  CoATalentExtractorDB.lattice = {}
  LAST_CAPTURE = nil
  PrintSuccess("All saved data cleared.")
  PrintSaveHint()
end

local function Help()
  PrintHeader("CoA Talent Extractor v1.0.0")
  Print(C_GOLD .. "  /coax scan" .. C_END ..      "      Full node + connection scan")
  Print(C_GOLD .. "  /coax lattice" .. C_END ..   "   Derive per-tree deterministic lattice")
  Print(C_GOLD .. "  /coax inspect" .. C_END ..   "   Inspect hovered frame topology")
  Print(C_GOLD .. "  /coax hover" .. C_END ..     "     Capture hovered node record")
  Print(C_GOLD .. "  /coax export" .. C_END ..    "    Canonical export (scan + lattice)")
  Print(C_GOLD .. "  /coax discover" .. C_END ..  "  Probe hidden providers/pools")
  Print(C_GOLD .. "  /coax dump" .. C_END ..      "      Print latest capture summary")
  Print(C_GOLD .. "  /coax roots" .. C_END ..     "     Check known root frames")
  Print(C_GOLD .. "  /coax clear" .. C_END ..     "     Clear all saved captures")
  Print(C_GOLD .. "  /coax help" .. C_END ..      "      Show this help")
  Print("")
  Print(C_GRAY .. "Workflow: open UI -> /coax scan -> /coax lattice -> /coax export -> /reload" .. C_END)
  Print(C_GRAY .. "File: WTF/Account/<ACCOUNT>/SavedVariables/CoATalentExtractor.lua" .. C_END)
end

SLASH_COATALENTEXTRACTOR1 = "/coax"
SLASH_COATALENTEXTRACTOR2 = "/coatalent"
SlashCmdList["COATALENTEXTRACTOR"] = function(message)
  message = strtrim(message or "")
  if message == "scan" then
    Scan()
  elseif message == "dump" then
    Dump()
  elseif message == "export" then
    Export()
  elseif message == "discover" then
    Discover()
  elseif message == "hover" then
    Hover()
  elseif message == "inspect" then
    Inspect()
  elseif message == "lattice" then
    Lattice()
  elseif message == "roots" then
    Roots()
  elseif message == "clear" then
    Clear()
  elseif message == "help" or message == "" then
    Help()
  elseif message == "debug" then
    DEBUG = not DEBUG
    Print("Debug mode: " .. (DEBUG and C_GREEN .. "ON" or C_RED .. "OFF") .. C_END)
  else
    PrintError("Unknown command: " .. message)
    Help()
  end
end

local loader = CreateFrame("Frame")
loader:RegisterEvent("ADDON_LOADED")
loader:SetScript("OnEvent", function(_, event, addonName)
  if event == "ADDON_LOADED" and addonName == ADDON_NAME then
    EnsureDB()
    Print(C_GOLD .. "CoA Talent Extractor" .. C_END .. " v1.0.0 loaded. Type " .. C_GOLD .. "/coax help" .. C_END)
  end
end)
