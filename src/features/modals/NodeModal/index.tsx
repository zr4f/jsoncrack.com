import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Textarea, Button, Group } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import toast from "react-hot-toast";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useJson from "../../../store/useJson";
import useFile from "../../../store/useFile";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

// Function to update json by path - preserves nested objects
const updateJsonByPath = (json: string, path: string | (string | number)[], editedFields: any, originalNode: any): string => {
  try {
    const obj = JSON.parse(json);
    let current = obj;
    
    if (!path || (Array.isArray(path) && path.length === 0)) {
      return JSON.stringify(editedFields, null, 2);
    }

    const pathArray = Array.isArray(path) ? path : [path];
    
    if (pathArray.length === 0) {
      return JSON.stringify(editedFields, null, 2);
    }
    
    // Navigate to the target node
    for (let i = 0; i < pathArray.length - 1; i++) {
      const key = pathArray[i];
      if (!(key in current)) {
        const nextKey = pathArray[i + 1];
        current[key] = typeof nextKey === "number" ? [] : {};
      }
      current = current[key];
    }

    const lastKey = pathArray[pathArray.length - 1];
    
    // If the target is an object, merge the edited fields while preserving nested structures
    if (current !== null && current !== undefined) {
      const targetNode = current[lastKey];
      
      if (targetNode && typeof targetNode === "object" && !Array.isArray(targetNode)) {
        // Preserve nested objects and arrays, only update the leaf fields
        const mergedNode = { ...targetNode };
        
        // Update only the leaf fields from editedFields
        Object.keys(editedFields).forEach(key => {
          const value = editedFields[key];
          // Only update if it's not an object/array (leaf values)
          if (typeof value !== "object" || value === null) {
            mergedNode[key] = value;
          }
        });
        
        current[lastKey] = mergedNode;
      } else {
        // For non-objects or arrays, replace entirely
        current[lastKey] = editedFields;
      }
    }

    return JSON.stringify(obj, null, 2);
  } catch (error) {
    console.error("Error updating JSON:", error);
    return json;
  }
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const setJson = useJson(state => state.setJson);
  const getJson = useJson(state => state.getJson);
  const setContents = useFile(state => state.setContents);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedValue, setEditedValue] = React.useState("");

  React.useEffect(() => {
    if (nodeData) {
      setEditedValue(normalizeNodeData(nodeData.text ?? []));
      setIsEditing(false);
    }
  }, [nodeData, opened]);

  const handleSave = () => {
    try {
      const currentJson = getJson();
      const pathArray = nodeData?.path ?? [];
      
      let editedFields;
      try {
        editedFields = JSON.parse(editedValue);
      } catch {
        editedFields = editedValue;
      }

      const updatedJson = updateJsonByPath(currentJson, pathArray, editedFields, nodeData);
      
      // Validate the updated JSON
      JSON.parse(updatedJson);
      
      // Update both JSON store and file contents
      setJson(updatedJson);
      setContents({ contents: updatedJson, hasChanges: true, skipUpdate: false });
      
      toast.success("Changes saved successfully!");
      setIsEditing(false);
      
      // Close the modal after successful save
      setTimeout(() => {
        onClose();
      }, 100);
    } catch (error) {
      console.error("Error saving changes:", error);
      toast.error("Invalid JSON format. Please check your input.");
    }
  };

  const handleCancel = () => {
    if (nodeData) {
      setEditedValue(normalizeNodeData(nodeData.text ?? []));
    }
    setIsEditing(false);
  };

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <CloseButton onClick={onClose} />
          </Flex>
          <ScrollArea.Autosize mah={250} maw={600}>
            {isEditing ? (
              <Textarea
                value={editedValue}
                onChange={(e) => setEditedValue(e.currentTarget.value)}
                placeholder="Enter JSON content"
                minRows={5}
                maxRows={15}
                style={{ width: "100%", minWidth: 350 }}
              />
            ) : (
              <CodeHighlight
                code={editedValue}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            )}
          </ScrollArea.Autosize>
        </Stack>
        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
        <Group justify="right" mt="md">
          {isEditing ? (
            <>
              <Button variant="default" onClick={handleCancel}>
                Cancel
              </Button>
              <Button color="green" onClick={handleSave}>
                Save
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
};
