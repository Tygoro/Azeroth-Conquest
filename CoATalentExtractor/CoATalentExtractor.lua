local ADDON_NAME = ...

CoATalentExtractorDB = CoATalentExtractorDB or {
  version = 2,
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

local DISCOVERY_MAX_DEPTH = 2
local DISCOVERY_MAX_OBJECTS = 60
local DISCOVERY_MAX_FIELDS = 24
local DISCOVERY_MAX_CHILDREN_PER_OBJECT = 8
local DISCOVERY_PROGRESS_INTERVAL = 10

local DEBUG = true
local LAST_CAPTURE = nil

local function Print(message)
  DEFAULT_CHAT_FRAME:AddMessage("|cffFFD700CoAExtract:|r " .. tostring(message))
end

local function Debug(message)
  if DEBUG then
    Print("debug: " .. tostring(message))
  end
end

local function EnsureDB()
  CoATalentExtractorDB = CoATalentExtractorDB or {}
  CoATalentExtractorDB.version = 2
  CoATalentExtractorDB.captures = CoATalentExtractorDB.captures or {}
  CoATalentExtractorDB.hover = CoATalentExtractorDB.hover or {}
  CoATalentExtractorDB.export = CoATalentExtractorDB.export or {}
  CoATalentExtractorDB.discovery = CoATalentExtractorDB.discovery or {}
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
    Print("discover progress: visited=" .. tostring(output.progress.visited)
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
  Print("discover roots: " .. tostring(#DISCOVERY_ROOT_NAMES))
  for _, name in ipairs(DISCOVERY_ROOT_NAMES) do
    local object = _G[name]
    table.insert(output.roots, {
      name = name,
      found = object ~= nil,
      objectName = DiscoveryObjectName(object),
      objectType = SafeObjectType(object),
      tableCount = SafeTableCount(object, DISCOVERY_MAX_FIELDS),
    })
    Print("discover root: " .. name .. " found=" .. tostring(object ~= nil))
    local ok, err = pcall(SnapshotObject, object, name, 0, seen, output)
    if not ok then
      output.progress.rootErrors = output.progress.rootErrors + 1
      Print("discover root error: " .. name .. " " .. tostring(err))
    end
  end
  local ok, err = pcall(SnapshotObject, root, "selectedRoot", 0, seen, output)
  if not ok then
    output.progress.rootErrors = output.progress.rootErrors + 1
    Print("discover selectedRoot error: " .. tostring(err))
  end
  Print("discover traversal done: visited=" .. tostring(output.progress.visited)
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

  return {
    frameName = FrameName(frame),
    objectType = frame.GetObjectType and frame:GetObjectType() or nil,
    isShown = isShown,
    isVisible = isVisible,
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

  if type(frame) == "table" then
    for key, value in pairs(frame) do
      if type(value) == "table" and value.GetName then
        local childName = value:GetName()
        local lowerKey = string.lower(tostring(key))
        if lowerKey:find("source") or lowerKey:find("from") or lowerKey:find("start") or lowerKey:find("parent") then
          connection.sourceNodeFrame = childName
        elseif lowerKey:find("target") or lowerKey:find("to") or lowerKey:find("end") or lowerKey:find("child") then
          connection.targetNodeFrame = childName
        end
      end
    end
  end

  Debug("line/connection detected: " .. tostring(connection.frameName)
    .. " source=" .. tostring(connection.sourceNodeFrame)
    .. " target=" .. tostring(connection.targetNodeFrame))

  return connection
end

local function BuildCapture()
  EnsureDB()

  if not IsTalentUIOpen() then
    Print("CoA talent UI is not visible. Open the talent window first.")
    return nil
  end

  local root, rootName = FindRootFrame()
  if not root then
    Print("No CoA talent root frame found.")
    return nil
  end

  local frames = {}
  TraverseFrame(root, frames, 0, {})

  local nodes = {}
  local hiddenNodes = 0
  local iconSuccess = 0

  for _, scannedFrame in ipairs(frames) do
    if IsTalentNodeFrame(scannedFrame) then
      local node = CaptureNode(scannedFrame, root)
      table.insert(nodes, node)
      if node.isShown == false or node.isVisible == false then hiddenNodes = hiddenNodes + 1 end
      if node.iconTexture then iconSuccess = iconSuccess + 1 end
      Print("node: " .. tostring(node.frameName)
        .. " shown=" .. tostring(node.isShown)
        .. " visible=" .. tostring(node.isVisible)
        .. " adv=" .. tostring(node.advancementId)
        .. " icon=" .. tostring(node.iconTexture))
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
    addonVersion = "0.2.0",
    rootName = rootName,
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
  Print("scan complete. frames=" .. tostring(capture.totalFramesScanned)
    .. " nodes=" .. tostring(capture.nodesFound)
    .. " hidden=" .. tostring(capture.hiddenNodesFound)
    .. " connections=" .. tostring(capture.connectionCount)
    .. " discoveryCandidates=" .. tostring(capture.discoveryCandidateNodeCount)
    .. " discoveryEdges=" .. tostring(capture.discoveryCandidateEdgeCount)
    .. " icons=" .. tostring(capture.iconSuccessCount))
  Print("SavedVariables will be written on /reload or logout.")
end

local function LatestCapture()
  EnsureDB()
  if LAST_CAPTURE then return LAST_CAPTURE end
  return CoATalentExtractorDB.captures[#CoATalentExtractorDB.captures]
end

local function Dump()
  local capture = LatestCapture()
  if not capture then
    Print("no capture available. Run /coax scan first.")
    return
  end
  Print("dump: nodes=" .. tostring(capture.nodesFound)
    .. " hidden=" .. tostring(capture.hiddenNodesFound)
    .. " connections=" .. tostring(capture.connectionCount)
    .. " discoveryCandidates=" .. tostring(capture.discoveryCandidateNodeCount)
    .. " discoveryEdges=" .. tostring(capture.discoveryCandidateEdgeCount)
    .. " icons=" .. tostring(capture.iconSuccessCount))
  if capture.discoverySummary then
    Print("discovery summary: nodeLike=" .. tostring(capture.discoverySummary.nodeLikeTableCount)
      .. " connectionLike=" .. tostring(capture.discoverySummary.connectionLikeTableCount))
  end
end

local function Export()
  local capture = LatestCapture()
  if not capture then capture = BuildCapture() end
  if not capture then return end

  local simplified = {}
  for index, node in ipairs(capture.nodes or {}) do
    table.insert(simplified, {
      id = node.frameName,
      advancementId = node.advancementId,
      name = node.parsedName,
      description = node.parsedDescription,
      icon = node.iconTexture,
      x = node.position and node.position.relativeToRoot and node.position.relativeToRoot.x or nil,
      y = node.position and node.position.relativeToRoot and node.position.relativeToRoot.y or nil,
      rank = node.parsedRank or node.primitiveFields.rank or node.primitiveFields.currentRank,
      visible = node.isVisible,
      locked = node.locked,
      nodeType = node.nodeType,
      autoGranted = node.autoGranted,
    })
  end

  CoATalentExtractorDB.export = {
    exportedAt = date and date("%Y-%m-%d %H:%M:%S") or "unknown",
    sourceCaptureAt = capture.capturedAt,
    nodes = simplified,
  }

  Print("export complete. nodes=" .. tostring(#simplified) .. ". SavedVariables will be written on /reload or logout.")
end

local function Discover()
  EnsureDB()
  local root = FindRootFrame()
  if not root then
    Print("No CoA talent root frame found.")
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
  Print("discovery started. record=" .. tostring(#CoATalentExtractorDB.discovery))
  local ok, discovery = pcall(DiscoverTalentData, root)
  if not ok then
    record.status = "error"
    record.error = tostring(discovery)
    Print("discovery failed: " .. tostring(discovery))
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
  Print("discovery complete. roots=" .. tostring(#record.roots)
    .. " objects=" .. tostring(#record.objects)
    .. " candidateNodes=" .. tostring(#record.candidateNodes)
    .. " candidateEdges=" .. tostring(#record.candidateEdges))
  Print("discovery summary: nodeLike=" .. tostring(summary.nodeLikeTableCount)
    .. " connectionLike=" .. tostring(summary.connectionLikeTableCount))
  Print("SavedVariables will be written on /reload or logout.")
end

local function Hover()
  EnsureDB()
  local focus = GetMouseFocus and GetMouseFocus() or nil
  if not focus then
    Print("No mouse focus frame found.")
    return
  end
  local root = FindRootFrame()
  local node = CaptureNode(focus, root)
  table.insert(CoATalentExtractorDB.hover, { capturedAt = date and date("%Y-%m-%d %H:%M:%S") or "unknown", node = node })
  Print("mouse focus: " .. tostring(node.frameName or "<unnamed>"))
  Print("hover capture saved. SavedVariables will be written on /reload or logout.")
end

local function Roots()
  for _, name in ipairs(ROOT_NAMES) do
    local frame = _G[name]
    if frame then
      Print(name .. ": found shown=" .. tostring(frame.IsShown and frame:IsShown() or "unknown") .. " visible=" .. tostring(frame.IsVisible and frame:IsVisible() or "unknown"))
    else
      Print(name .. ": missing")
    end
  end
end

local function Clear()
  EnsureDB()
  CoATalentExtractorDB.captures = {}
  CoATalentExtractorDB.hover = {}
  CoATalentExtractorDB.export = {}
  CoATalentExtractorDB.discovery = {}
  LAST_CAPTURE = nil
  Print("captures cleared.")
end

local function Help()
  Print("commands:")
  Print("/coax scan   - scan all CoA talent node frames, including hidden/inactive")
  Print("/coax dump   - print summary of latest capture")
  Print("/coax export - create simplified export table")
  Print("/coax discover - probe non-visual providers, pools, mixins, and node data")
  Print("/coax hover  - capture the frame currently under the mouse")
  Print("/coax roots  - check known CoA root frames")
  Print("/coax clear  - clear saved captures")
end

SLASH_COATALENTEXTRACTOR1 = "/coax"
SlashCmdList["COATALENTEXTRACTOR"] = function(message)
  message = message or ""
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
  elseif message == "roots" then
    Roots()
  elseif message == "clear" then
    Clear()
  else
    Help()
  end
end

local loader = CreateFrame("Frame")
loader:RegisterEvent("ADDON_LOADED")
loader:SetScript("OnEvent", function(_, event, addonName)
  if event == "ADDON_LOADED" and addonName == ADDON_NAME then
    EnsureDB()
    Print("loaded. Open CoA talents and run /coax scan.")
  end
end)
