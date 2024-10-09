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

// *************

// Function to add a new column to the customers table
const addColumnToCustomers = async (connection, fieldName, fieldType) => {
    // Validate the fieldName
    const isValidColumnName = (name) => /^[a-zA-Z0-9_ ]+$/.test(name); // Allow spaces

    if (!isValidColumnName(fieldName)) {
        throw new Error(`Invalid column name: ${fieldName}`);
    }

    // Validate the fieldType
    const validFieldTypes = ['text', 'dropdown'];
    if (!validFieldTypes.includes(fieldType)) {
        throw new Error(`Invalid field type: ${fieldType}. Allowed types are: ${validFieldTypes.join(', ')}`);
    }

    // Determine the correct MySQL type based on fieldType
    const columnType = fieldType === 'text' ? 'VARCHAR(255)' : 'TEXT';
    const columnName = connection.escape('fieldName');

    // Check if the column already exists
    const columnCheckQuery = `SHOW COLUMNS FROM customers LIKE ${columnName}`;

    const [existingColumns] = await connection.execute(columnCheckQuery);

    if (existingColumns.length > 0) {
        throw new Error(`Column already exists: ${fieldName}`);
    }

    const alterTableQuery = `ALTER TABLE customers ADD COLUMN \`${fieldName}\` ${columnType}`; // Enclose fieldName in backticks

    try {
        console.log("Attempting to add column:", fieldName); // Log the field name for debugging
        await connection.execute(alterTableQuery); // Execute without parameters
        console.log(`Successfully added column ${fieldName} with type ${columnType}`);
    } catch (error) {
        console.error('Error executing alter table query:', error);
        throw new Error('Failed to add the column due to a database error.');
    }
};


// ************

// Function to insert a new custom field in 'custom_field'
const insertCustomField = async (connection, fieldName, fieldType, dropdownOptions) => {
    const insertQuery = `
        INSERT INTO custom_field (field_name, field_type, dropdown_options) 
        VALUES (?, ?, ?)`;

    // Ensure dropdownOptions is either a valid string or null
    const optionss = dropdownOptions && dropdownOptions.length > 0 ? JSON.stringify(dropdownOptions) : null;

    // Log parameters for debugging
    console.log("Executing insertCustomField with parameters:", {
        fieldName,
        fieldType,
        optionss,
    });

    // Ensure all parameters are not undefined
    if (fieldName === undefined || fieldType === undefined) {
        throw new Error('One or more parameters are undefined');
    }

    try {
        // Insert the custom field into the 'custom_fields' table
        const [result] = await connection.execute(insertQuery, [fieldName, fieldType, optionss]);
        console.log("Insert result:", result);
    } catch (err) {
        console.error("Error executing insertCustomField:", err);
        throw err; // Re-throw the error to be caught in the addCustomField function
    }
};



// Function to validate field types
const isValidFieldType = (fieldType) => {
    const validTypes = ['text', 'dropdown'];
    return validTypes.includes(fieldType);
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


// *************

export const getCustomFields = async (req, res) => {
    try {
      const connection = await connectDB();
      const query = `SELECT * FROM custom_field`;  
      const [rows] = await connection.execute(query);
      res.status(200).json(rows);
    } catch (error) {
      console.error('Error fetching custom fields:', error);
      res.status(500).json({ message: 'Failed to fetch custom fields' });
    }
  };

//**************

// Function to insert custom values into `customer_custom_values`
const insertCustomValues = async (connection, customer_id, fieldId, fieldValue) => {
    const insertQuery = `
        INSERT INTO custom_field_values (customer_id, field_id, field_value) 
        VALUES (?, ?, ?)`;
    await connection.execute(insertQuery, [customer_id, fieldId, fieldValue]);
    console.log("Request data:", { customer_id, fieldValue });

};


// Function to check if a customer exists by company_unique_id
const customerExists = async (connection, customer_id) => {
    const query = `
        SELECT * FROM customers 
        WHERE company_unique_id = ?`;
    const [rows] = await connection.execute(query, [customer_id]);
    return rows.length > 0; // Return true if customer exists
};

// Controller to handle adding custom values for a customer
export const addCustomValues = async (req, res) => {
    const { customer_id, customFields } = req.body;  

    if (!customer_id || !Array.isArray(customFields) || customFields.length === 0) {
        return res.status(400).json({ message: 'Invalid request data' });
    }

    let connection;
    try {
        connection = await connectDB();

        // Check if the customer exists
        const customerExistsFlag = await customerExists(connection, customer_id);
        if (!customerExistsFlag) {
            return res.status(404).json({ message: `Customer with ID ${customer_id} not found.` });
        }

        // Insert the custom values for the customer
        for (const field of customFields) {
            const { fieldId, fieldValue } = field;  
            await insertCustomValues(connection, customer_id, fieldId, fieldValue);
        }

        res.status(200).json({ message: 'Custom values added successfully!' });
    } catch (error) {
        console.error('Error adding custom values:', error);
        res.status(500).json({ message: 'Failed to add custom values' });
    } finally {
        if (connection) {
            await connection.end();  // Ensure the connection is closed
        }
    }
};




// Fetch all customers with custom fields
// export const getAllCustomers = async (req, res) => {
//   try {
//     const connection = await connectDB();

//     // Step 1: Fetch all custom field names
//     const customFieldsQuery = `
//       SELECT field_name 
//       FROM custom_field`;
//     const [customFieldsRows] = await connection.execute(customFieldsQuery);
    
//     // Step 2: Construct the dynamic SQL query
//     const customFieldColumns = customFieldsRows.map(cf => 
//       `MAX(CASE WHEN cf.field_name = '${cf.field_name}' THEN cfv.field_value END) AS \`${cf.field_name}\``
//     ).join(', ');

//     const query = `
//       SELECT c.id AS customer_id,
//              c.first_name,
//              c.last_name,
//              c.phone_no,
//              c.email_id,
//              c.date_of_birth,
//              c.address,
//              c.company_name,
//              c.company_unique_id,
//              c.contact_type,
//              c.source,
//              c.disposition,
//              c.agent_name,
//              c.date_created,
//              ${customFieldColumns}  -- Include dynamically constructed fields
//       FROM customers AS c
//       LEFT JOIN custom_field_values AS cfv ON c.company_unique_id = cfv.comp_unique_id
//       LEFT JOIN custom_field AS cf ON cfv.field_id = cf.id
//       GROUP BY c.id  -- Don't forget to group by customer ID
//       ORDER BY c.id;`;

//     const [rows] = await connection.execute(query);
    
//     res.status(200).json(rows);
//   } catch (error) {
//     console.error('Error fetching customers:', error);
//     res.status(500).json({ message: 'Failed to fetch records' });
//   }
// };