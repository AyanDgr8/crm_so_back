// src/controllers/custom.js

import connectDB from '../db/index.js';  // Connection to DB

// Function to check if a column already exists
const columnExists = async (connection, columnName) => {
    const query = `
        SELECT * FROM information_schema.COLUMNS 
        WHERE TABLE_NAME = 'customers' AND COLUMN_NAME = ?`;
    const [rows] = await connection.execute(query, [columnName]);
    return rows.length > 0;
};

// Function to add a new column to the customers table
const addColumnToCustomers = async (connection, fieldName, fieldType) => {
    // Validate the fieldName
    const isValidColumnName = (name) => /^[a-zA-Z0-9_ ]+$/.test(name); // Allow spaces

    if (!isValidColumnName(fieldName)) {
        throw new Error(`Invalid column name: ${fieldName}`);
    }

    // Determine the correct MySQL type based on fieldType
    let columnType;
    switch (fieldType) {
        case 'text':
            columnType = 'VARCHAR(255)';
            break;
        case 'dropdown':
            columnType = 'TEXT';
            break;
        case 'dropdown_checkbox':
            columnType = 'TEXT';
            break;
        case 'datetime':
            columnType = 'DATETIME'; 
            break;
        default:
            throw new Error(`Unsupported field type: ${fieldType}`);
    }

    const alterTableQuery = `ALTER TABLE customers ADD COLUMN \`${fieldName}\` ${columnType}`; // Enclose fieldName in backticks

    console.log("Attempting to add column:", fieldName); // Log the field name for debugging
    await connection.execute(alterTableQuery); // Execute without parameters
};


// Function to validate field types
const isValidFieldType = (fieldType) => {
    const validTypes = ['text', 'dropdown', 'datetime'];
    return validTypes.includes(fieldType);
};

// Function to insert a new custom field in 'custom_fields'
const insertCustomField = async (connection, fieldName, fieldType, dropdownOptions) => {
    const insertQuery = `
        INSERT INTO custom_field (field_name, field_type, dropdown_options) 
        VALUES (?, ?, ?)`;

    // Ensure dropdownOptions is either a valid string or null
    const options = dropdownOptions && dropdownOptions.length > 0 ? JSON.stringify(dropdownOptions) : null;


    // Ensure all parameters are not undefined
    if (fieldName === undefined || fieldType === undefined) {
        throw new Error('One or more parameters are undefined');
    }

    // Log parameters for debugging
    console.log("Executing insertCustomField with parameters:", {
        fieldName,
        fieldType,
        options
    });
    
    try {
        // Insert the custom field into the 'custom_fields' table
        const [result] = await connection.execute(insertQuery, [fieldName, fieldType, options]);
        console.log("Insert result:", result);
    } catch (err) {
        console.error("Error executing insertCustomField:", err);
        throw err; // Re-throw the error to be caught in the addCustomField function
    }
};

// Controller for adding custom fields
export const addCustomField = async (req, res) => {
    const { formFields } = req.body;
    let connection;

    if (!formFields || !Array.isArray(formFields) || formFields.length === 0) {
        return res.status(400).json({ message: 'Form fields are required' });
    }

    try {
        connection = await connectDB();
        await connection.beginTransaction();

        for (const field of formFields) {
            const { fieldName, fieldType, dropdownOptions } = field;

            if (!fieldName) {
                return res.status(400).json({ message: 'Field name is required for all fields' });
            }

            if (!isValidFieldType(fieldType)) {
                return res.status(400).json({ message: `Invalid field type '${fieldType}' provided.` });
            }

            if (await columnExists(connection, fieldName)) {
                return res.status(400).json({ message: `Column '${fieldName}' already exists in customers table.` });
            }

            await insertCustomField(connection, fieldName, fieldType, dropdownOptions);
            await addColumnToCustomers(connection, fieldName, fieldType);
        }

        await connection.commit();
        res.status(200).json({ message: 'Custom fields added and customers table updated successfully!' });

    } catch (error) {
        console.error('Error adding custom fields:', error);
        if (connection) {
            await connection.rollback();
        }
        res.status(500).json({ message: 'Failed to add custom fields', error: error.message });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
};

// Function to execute SQL queries
const executeQuery = async (connection, query, params) => {
    try {
        console.log("Executing query:", query, "with params:", params); // Log the query and parameters before execution
        const [result] = await connection.execute(query, params);
        console.log("Query executed successfully:", result); // Log the result after execution
        return result; // Return the result of the query
    } catch (error) {
        console.error("Error executing query:", error);
        throw error;  // Re-throw the error to be caught in the calling function
    }
};

// **************
// **************
// **************

// Function to insert a custom value in 'custom_field_values'
const insertCustomValues = async (connection, comp_unique_id, fieldId, fieldValue) => {
    const query = `
      INSERT INTO custom_field_values (comp_unique_id, field_id, field_value) 
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE field_value = VALUES(field_value)`;  
    await connection.execute(query, [comp_unique_id, fieldId, fieldValue]);
};

// Function to check if a custom field already exists
const checkCustomFieldExists = async (connection, comp_unique_id, fieldId) => {
    // ***********
    const checkQuery = `
        SELECT COUNT(*) as count
        FROM custom_field_values 
        WHERE comp_unique_id = ? AND field_id = ?`;

    try {
        const [result] = await connection.execute(checkQuery, [comp_unique_id, fieldId]);
        
        // Log the result for debugging purposes
        console.log("Query result:", result);

        // Check if result is valid and return true if the count is greater than 0
        return result[0].count > 0;
    } catch (error) {
        console.error("Error executing checkCustomFieldExists:", error);
        throw new Error("Database query failed");
    }
};

// Controller to handle adding custom values for a customer
export const addCustomValues = async (req, res) => {
    const comp_unique_id = req.params.id;
    const { customFields } = req.body;  

    // Validate input
    if (!comp_unique_id || !Array.isArray(customFields) || customFields.length === 0) {
        return res.status(400).json({ message: 'Invalid request data' });
    }

    let connection;
    try {
        connection = await connectDB();
        await connection.beginTransaction(); // Start transaction

        // Insert custom values concurrently
        const insertPromises = customFields.map(async (field) => {
            const { fieldId, fieldValue } = field;

            // Ensure no undefined values are passed
            if (!fieldId || typeof fieldValue === 'undefined') {
                throw new Error(`Field ID or Field Value is missing or invalid for field: ${JSON.stringify(field)}`);
            }

            // Check if the custom field already exists
            const exists = await checkCustomFieldExists(connection, comp_unique_id, fieldId);

            if (!exists) {
                await insertCustomValues(connection, comp_unique_id, fieldId, fieldValue);
            } else {
                console.log(`Custom field with fieldId: ${fieldId} already exists. Skipping insertion.`);
            }
        });

        await Promise.all(insertPromises); // Wait for all insertions to complete

        await connection.commit(); // Commit transaction
        res.status(200).json({ message: 'Custom values added successfully!' });
    } catch (error) {
        console.error('Error adding custom values:', error);

        if (connection) {
            await connection.rollback(); // Rollback transaction on error
        }
        
        res.status(500).json({ message: error.message || 'Failed to add custom values' });
    } finally {
        if (connection) {
            await connection.end();  // Ensure the connection is closed
        }
    }
};

// Controller to update existing custom values
export const updateCustomValues = async (req, res) => {
    const { comp_unique_id, customFields } = req.body;

    // Validate customFields
    if (!comp_unique_id || typeof comp_unique_id !== 'string' || !Array.isArray(customFields) || customFields.length === 0) {
        return res.status(400).json({ message: 'Invalid request data: comp_unique_id and customFields should be a non-empty array.' });
    }

    let connection;
    try {
        connection = await connectDB();
        await connection.beginTransaction();

        // Prepare SQL query for updating custom field values using a CASE WHEN clause
        const updateQuery = `
            UPDATE custom_field_values
            SET field_value = CASE
                ${customFields.map(() => `WHEN field_id = ? THEN ?`).join(' ')}
            END
            WHERE comp_unique_id = ? AND field_id IN (${customFields.map(() => '?').join(', ')})
        `;

        const params = customFields.flatMap(field => [field.fieldId, field.fieldValue]);
        const fieldIds = customFields.map(field => field.fieldId);
        params.push(comp_unique_id, ...fieldIds);

        if (params.length === 0) {
            return res.status(400).json({ message: 'No valid custom fields to update.' });
        }

        console.log("Executing update with query:", updateQuery);
        const updateResult = await connection.execute(updateQuery, params);
        console.log("Update result:", updateResult);

        await connection.commit();

        // Fetch the updated customers along with custom fields after the update
        const customersWithCustomFields = await getCustomersWithCustomFields(req, res);
        res.status(200).json({ message: 'Custom values updated successfully!', updatedCount: updateResult[0].affectedRows, customers: customersWithCustomFields });
    } catch (error) {
        console.error('Error updating custom values:', error);

        if (connection) {
            await connection.rollback();
        }

        res.status(500).json({ message: error.message || 'Failed to update custom values' });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
};


// ************
// ************
// ************

// Controller to fetch customers along with their custom field values
export const getCustomersWithCustomFields = async (req, res) => {
    let connection;

    try {
        connection = await connectDB();
        
        // SQL query to fetch customers with custom fields and their values
        const query = `
            SELECT 
                c.id AS customer_id,
                c.first_name,
                c.last_name,
                c.phone_no,
                c.email_id,
                c.date_of_birth,
                c.address,
                c.company_name,
                c.company_unique_id,
                c.contact_type,
                c.source,
                c.disposition,
                c.agent_name,
                c.date_created,
                cf.field_name,
                cfv.field_value
            FROM 
                customers AS c
            LEFT JOIN 
                custom_field_values AS cfv ON c.company_unique_id = cfv.comp_unique_id
            LEFT JOIN 
                custom_field AS cf ON cfv.field_id = cf.id
            ORDER BY 
                c.id, cf.field_name;
        `;

        const [rows] = await connection.execute(query);

        // Process rows to group field values by customer
        const customers = {};

        rows.forEach(row => {
            const { customer_id, first_name, last_name, ...rest } = row;

            // If the customer doesn't exist in the object, add them
            if (!customers[customer_id]) {
                customers[customer_id] = {
                    customer_id,
                    first_name,
                    last_name,
                    custom_fields: [],
                    // Include other customer attributes from 'rest'
                    ...rest
                };
            }

            // If there's a field value, push it into the customer's custom fields
            if (row.field_name && row.field_value) {
                customers[customer_id].custom_fields.push({
                    field_name: row.field_name,
                    field_value: row.field_value
                });
            }
        });

        // Convert customers object to an array
        const customersArray = Object.values(customers);

        res.status(200).json(customersArray); // Return the array of customers with custom fields
    
    } catch (error) {
        console.error('Error fetching customers with custom fields:', error);
        res.status(500).json({ message: 'Failed to fetch customers with custom fields' });
    } finally {
        if (connection) {
            await connection.end();  // Ensure the connection is closed
        }
    }
};

// Controller to get custom fields 
export const getCustomFields = async (req, res) => {
    let connection;

    try {
        connection = await connectDB();
        const query = `SELECT * FROM custom_field`;  
        const [rows] = await connection.execute(query);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching custom fields:', error);
        res.status(500).json({ message: 'Failed to fetch custom fields' });
    } finally {
        if (connection) {
            await connection.end();  
        }
    }
};
